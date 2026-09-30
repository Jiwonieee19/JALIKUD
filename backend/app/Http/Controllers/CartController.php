<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Coupon;
use App\Models\MenuItem;
use App\Services\CartPricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Manage the authenticated user's cart.
 */
class CartController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $cart = $this->getCart($request);

        $cart->load(['cartItems.menuItem', 'cartItems.options.variantOption', 'address', 'coupon']);

        return response()->json(['data' => $cart]);
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

        return DB::transaction(function () use ($request, $menuItem, $data, $options) {
            $cart = $this->getCart($request);

            $cartItem = $cart->cartItems()->create([
                'menu_item_id' => $menuItem->id,
                'quantity' => $data['quantity'],
                'unit_price' => $menuItem->base_price,
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($options as $option) {
                $cartItem->options()->create([
                    'variant_option_id' => $option->id,
                    'price_delta' => $option->price_delta,
                ]);
            }

            $cart->load(['cartItems.menuItem', 'cartItems.options.variantOption']);

            return response()->json(['data' => $cart], 201);
        });
    }

    public function updateItem(Request $request, Cart $cart, CartItem $cartItem): JsonResponse
    {
        if ($cart->user_id !== $request->user()->id || $cartItem->cart_id !== $cart->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'quantity' => ['sometimes', 'integer', 'min:1', 'max:99'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $cartItem->update($data);

        return response()->json(['data' => $cartItem]);
    }

    public function removeItem(Request $request, Cart $cart, CartItem $cartItem): JsonResponse
    {
        if ($cart->user_id !== $request->user()->id || $cartItem->cart_id !== $cart->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $cartItem->delete();

        return response()->json(['message' => 'Item removed from cart.']);
    }

    public function destroy(Request $request): JsonResponse
    {
        $cart = $this->getCart($request);
        $cart->cartItems()->delete();
        $cart->update(['address_id' => null, 'coupon_id' => null]);

        return response()->json(['message' => 'Cart cleared.']);
    }

    public function applyCoupon(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50'],
        ]);

        $cart = $this->getCart($request);

        $coupon = Coupon::where('code', $data['code'])->first();

        if (! $coupon) {
            return response()->json(['message' => 'Coupon code not found or inactive.'], 422);
        }

        // Enforce window + usage limits at apply time (subtotal not enforced here;
        // checkout re-checks everything and fails closed).
        $reason = $coupon->rejectionReason(null, $request->user()->id);

        if ($reason !== null) {
            return response()->json(['message' => $reason], 422);
        }

        $cart->update(['coupon_id' => $coupon->id]);
        $cart->load('cartItems.menuItem', 'coupon');

        return response()->json(['data' => $cart]);
    }

    private function getCart(Request $request): Cart
    {
        return Cart::firstOrCreate(
            ['user_id' => $request->user()->id],
            ['session_id' => null, 'order_type' => 'delivery'],
        );
    }
}