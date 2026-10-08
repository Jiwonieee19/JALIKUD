<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Coupon;
use App\Models\MenuItem;
use App\Services\CartPricingService;
use App\Services\PointLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Manage the authenticated user's cart.
 */
class CartController extends Controller
{
    public function index(Request $request, CartPricingService $pricing): JsonResponse
    {
        $cart = $this->getCart($request);

        return DB::transaction(function () use ($cart, $request, $pricing) {
            // Heal carts split before merge-on-add existed: fold identical
            // lines into one row so the app always shows a single row.
            $this->collapseAllDuplicates($cart);

            return $this->cartResponse($cart, $request, $pricing);
        });
    }

    public function addItem(Request $request, CartPricingService $pricing): JsonResponse
    {
        $data = $request->validate([
            'menu_item_id' => ['required', 'exists:menu_items,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'notes' => ['nullable', 'string', 'max:500'],
            'options' => ['nullable', 'array', 'max:20'],
            'options.*.variant_option_id' => ['required', 'exists:variant_options,id', 'distinct'],
        ]);

        $menuItem = MenuItem::findOrFail($data['menu_item_id']);

        if (! $menuItem->is_available) {
            return response()->json(['message' => 'This item is currently unavailable.'], 422);
        }

        $requestedIds = collect($data['options'] ?? [])->pluck('variant_option_id')->map(fn ($id) => (int) $id)->values()->all();

        $errors = $pricing->optionSelectionErrors($menuItem, $requestedIds, $pricing->selectableOptionIds($menuItem));

        if (! empty($errors)) {
            return response()->json(['message' => implode(' ', $errors), 'errors' => ['options' => $errors]], 422);
        }

        // Snapshot the real option price deltas (server-authoritative values).
        $options = empty($requestedIds)
            ? collect()
            : $menuItem->variantGroups()->with('variantOptions')->get()
                ->flatMap->variantOptions
                ->whereIn('id', $requestedIds);

        return DB::transaction(function () use ($request, $menuItem, $data, $options, $pricing, $requestedIds) {
            $cart = $this->getCart($request);
            $notes = ($data['notes'] ?? null) !== null && trim((string) ($data['notes'] ?? '')) !== ''
                ? trim((string) $data['notes'])
                : null;
            sort($requestedIds);

            // Merge with an identical line (same item + same options + same
            // notes) instead of stacking a duplicate row for every tap.
            $existing = $cart->cartItems()->with('options')
                ->where('menu_item_id', $menuItem->id)
                ->get()
                ->first(function (CartItem $candidate) use ($notes, $requestedIds) {
                    $candidateNotes = $candidate->notes !== null && trim((string) $candidate->notes) !== ''
                        ? trim((string) $candidate->notes)
                        : null;
                    $candidateOptionIds = $candidate->options->pluck('variant_option_id')
                        ->map(fn ($id) => (int) $id)->sort()->values()->all();

                    return $candidateNotes === $notes && $candidateOptionIds === $requestedIds;
                });

            if ($existing !== null) {
                $this->collapseMatching($cart, $existing);

                $existing->refresh();
                $room = 99 - (int) $existing->quantity;

                if ($room > 0) {
                    $existing->increment('quantity', min((int) $data['quantity'], $room));
                }

                return $this->cartResponse($cart, $request, $pricing);
            }

            $cartItem = $cart->cartItems()->create([
                'menu_item_id' => $menuItem->id,
                'quantity' => $data['quantity'],
                'unit_price' => $menuItem->base_price,
                'notes' => $notes,
            ]);

            foreach ($options as $option) {
                $cartItem->options()->create([
                    'variant_option_id' => $option->id,
                    'price_delta' => $option->price_delta,
                ]);
            }

            $this->collapseAllDuplicates($cart, $cartItem->id);

            return $this->cartResponse($cart, $request, $pricing, 201);
        });
    }

    public function updateItem(Request $request, Cart $cart, CartItem $cartItem, CartPricingService $pricing): JsonResponse
    {
        if ($cart->user_id !== $request->user()->id || $cartItem->cart_id !== $cart->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'quantity' => ['sometimes', 'integer', 'min:1', 'max:99'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $cartItem->update($data);

        return $this->cartResponse($cart, $request, $pricing);
    }

    public function removeItem(Request $request, Cart $cart, CartItem $cartItem, CartPricingService $pricing): JsonResponse
    {
        if ($cart->user_id !== $request->user()->id || $cartItem->cart_id !== $cart->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $cartItem->delete();

        return $this->cartResponse($cart, $request, $pricing);
    }

    public function destroy(Request $request, CartPricingService $pricing): JsonResponse
    {
        $cart = $this->getCart($request);
        $cart->cartItems()->delete();
        $cart->update(['address_id' => null, 'coupon_id' => null, 'reward_key' => null]);

        return $this->cartResponse($cart, $request, $pricing);
    }

    public function applyCoupon(Request $request, CartPricingService $pricing): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50'],
        ]);

        $cart = $this->getCart($request);

        if ($cart->reward_key !== null) {
            return response()->json(['message' => 'Remove the selected reward before applying a coupon.'], 422);
        }

        $coupon = Coupon::where('code', $data['code'])->first();

        if (! $coupon) {
            return response()->json(['message' => 'Coupon code not found or inactive.'], 422);
        }

        $priced = $pricing->price($cart);
        $reason = $coupon->rejectionReason($priced['subtotal'], $request->user()->id);

        if ($reason !== null) {
            $response = ['message' => $reason];

            if ($reason === 'Order subtotal does not meet the coupon minimum.') {
                $minimum = (float) $coupon->min_order_amount;
                $response['coupon'] = [
                    'code' => $coupon->code,
                    'type' => $coupon->type,
                    'value' => $coupon->value,
                    'min_order_amount' => $coupon->min_order_amount,
                    'max_discount_amount' => $coupon->max_discount_amount,
                ];
                $response['required_additional_amount'] = number_format(
                    max(0, $minimum - (float) $priced['subtotal']),
                    2,
                    '.',
                    ''
                );
            }

            return response()->json($response, 422);
        }

        $cart->update(['coupon_id' => $coupon->id]);

        return $this->cartResponse($cart, $request, $pricing);
    }

    public function removeCoupon(Request $request, CartPricingService $pricing): JsonResponse
    {
        $cart = $this->getCart($request);
        $cart->update(['coupon_id' => null]);

        return $this->cartResponse($cart, $request, $pricing);
    }

    /**
     * Reserve a reward on the cart. Points are only checked here — they are
     * deducted if and when checkout succeeds, never on selection.
     */
    public function applyReward(Request $request, CartPricingService $pricing): JsonResponse
    {
        $data = $request->validate([
            'reward_key' => ['required', 'string', 'max:50'],
        ]);

        $definition = PointLedger::definition($data['reward_key']);

        if ($definition === null) {
            return response()->json(['message' => 'Reward not found.'], 422);
        }

        $cart = $this->getCart($request);

        if ($cart->coupon_id !== null) {
            return response()->json(['message' => 'Remove the applied coupon before selecting a reward.'], 422);
        }

        $balance = PointLedger::balance($request->user()->id);

        if ($balance < (int) ($definition['points_cost'] ?? PHP_INT_MAX)) {
            return response()->json(['message' => 'Not enough points for this reward.'], 422);
        }

        $cart->update(['reward_key' => $data['reward_key']]);

        // Eligibility details (item in cart, voucher minimum) surface as
        // pricing_errors on the returned cart rather than a rejection.
        return $this->cartResponse($cart, $request, $pricing);
    }

    public function removeReward(Request $request, CartPricingService $pricing): JsonResponse
    {
        $cart = $this->getCart($request);
        $cart->update(['reward_key' => null]);

        return $this->cartResponse($cart, $request, $pricing);
    }

    /**
     * Update the cart's fulfillment details (order type / delivery address) so
     * the server-priced totals reflect the chosen method. The cart is created
     * with `order_type` defaulting to `delivery`; without a way to flip it to
     * `pickup`, the cart preview would always quote the store's delivery fee.
     */
    public function update(Request $request, CartPricingService $pricing): JsonResponse
    {
        $data = $request->validate([
            'order_type' => ['sometimes', 'in:delivery,pickup'],
            'address_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('addresses', 'id')->where('user_id', $request->user()->id),
            ],
        ]);

        $cart = $this->getCart($request);
        $cart->update($data);

        return $this->cartResponse($cart, $request, $pricing);
    }

    private function getCart(Request $request): Cart
    {
        return Cart::firstOrCreate(
            ['user_id' => $request->user()->id],
            ['session_id' => null, 'order_type' => 'delivery'],
        );
    }

    /**
     * Identity of a cart line for merging: same item + same options + same
     * notes. Different options/notes stay as separate rows on purpose.
     */
    private function lineKey(CartItem $item): string
    {
        $notes = $item->notes !== null && trim((string) $item->notes) !== ''
            ? trim((string) $item->notes)
            : '';
        $optionIds = $item->relationLoaded('options')
            ? $item->options->pluck('variant_option_id')->map(fn ($id) => (int) $id)->sort()->values()->all()
            : [];

        return $item->menu_item_id.'|'.$notes.'|'.implode(',', $optionIds);
    }

    /**
     * Fold every other line identical to $kept into $kept (qty capped at 99).
     */
    private function collapseMatching(Cart $cart, CartItem $kept): void
    {
        $kept->loadMissing('options');
        $key = $this->lineKey($kept);

        $duplicates = $cart->cartItems()->with('options')->get()
            ->filter(fn (CartItem $candidate) => $candidate->id !== $kept->id && $this->lineKey($candidate) === $key)
            ->sortBy('id')
            ->values();

        foreach ($duplicates as $duplicate) {
            $room = 99 - (int) $kept->quantity;
            if ($room > 0) {
                $kept->increment('quantity', min((int) $duplicate->quantity, $room));
            }
            $duplicate->delete();
        }
    }

    /**
     * Fold all identical-line groups in the cart into single rows (qty capped
     * at 99, earliest row kept). Heals carts split before merge-on-add.
     */
    private function collapseAllDuplicates(Cart $cart, ?int $excludeId = null): void
    {
        $lines = $cart->cartItems()->with('options')->get()
            ->when($excludeId !== null, fn ($collection) => $collection->reject(fn (CartItem $item) => $item->id === $excludeId))
            ->groupBy(fn (CartItem $item) => $this->lineKey($item));

        foreach ($lines as $group) {
            if ($group->count() < 2) {
                continue;
            }

            $ordered = $group->sortBy('id')->values();
            $kept = $ordered->first();
            $total = min(99, (int) $ordered->sum('quantity'));

            $kept->update(['quantity' => $total]);
            $ordered->skip(1)->each(fn (CartItem $duplicate) => $duplicate->delete());
        }
    }

    private function cartResponse(Cart $cart, Request $request, CartPricingService $pricing, int $status = 200): JsonResponse
    {
        return response()->json([
            'data' => $pricing->serialize($cart->fresh(), $request->user()->id),
        ], $status);
    }
}
