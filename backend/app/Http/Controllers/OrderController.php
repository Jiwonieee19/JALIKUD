<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\PaginationRequest;
use App\Models\Cart;
use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\Order;
use App\Models\StoreSetting;
use App\Services\CartPricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Browse and manage orders for the authenticated user.
 */
class OrderController extends Controller
{
    /**
     * Allowed status transitions (server-side; keeps the in: rule honest).
     */
    private const STATUS_TRANSITIONS = [
        Order::STATUS_PENDING => [Order::STATUS_CONFIRMED, Order::STATUS_CANCELLED],
        Order::STATUS_CONFIRMED => [Order::STATUS_PREPARING, Order::STATUS_CANCELLED],
        Order::STATUS_PREPARING => [Order::STATUS_READY, Order::STATUS_CANCELLED],
        Order::STATUS_READY => [Order::STATUS_OUT_FOR_DELIVERY, Order::STATUS_CANCELLED],
        Order::STATUS_OUT_FOR_DELIVERY => [Order::STATUS_COMPLETED, Order::STATUS_CANCELLED],
        Order::STATUS_COMPLETED => [],
        Order::STATUS_CANCELLED => [],
    ];

    public function index(PaginationRequest $request): JsonResponse
    {
        $user = $request->user();
        $query = Order::query()->orderByDesc('placed_at');

        // Admins see all orders; customers see their own.
        if (! $user->isAdmin()) {
            $query->where('user_id', $user->id);
        }

        $orders = $query->paginate($request->perPage(10));

        return response()->json(['data' => $orders]);
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        if ($order->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $order->load(['user', 'address', 'rider', 'coupon', 'orderItems.options', 'statusHistory', 'payments', 'reviews']);

        return response()->json(['data' => $order]);
    }

    /**
     * POST /api/orders - place an order from the current cart.
     */
    public function store(Request $request, CartPricingService $pricing): JsonResponse
    {
        $data = $request->validate([
            'order_type' => ['required', 'in:delivery,pickup'],
            'address_id' => [
                'required_if:order_type,delivery',
                'nullable',
                Rule::exists('addresses', 'id')->where('user_id', $request->user()->id),
            ],
            'coupon_code' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'scheduled_for' => ['nullable', 'date'],
        ]);

        $user = $request->user();

        // The store must be able to accept the order right now.
        if (! StoreSetting::isOpenNow()) {
            return response()->json(['message' => 'The store is currently closed.'], 422);
        }

        return DB::transaction(function () use ($request, $data, $user, $pricing) {
            $cart = Cart::where('user_id', $user->id)
                ->with(['cartItems.menuItem', 'cartItems.options.variantOption'])
                ->first();

            if (! $cart || $cart->cartItems->isEmpty()) {
                return response()->json(['message' => 'Your cart is empty.'], 422);
            }

            // Re-price lines against the live catalog; stale/unavailable carts fail closed.
            $priced = $pricing->price($cart);

            if (! empty($priced['errors'])) {
                return response()->json(['message' => implode(' ', $priced['errors']), 'errors' => ['items' => $priced['errors']]], 422);
            }

            $subtotal = $priced['subtotal'];

            $coupon = null;
            $discountAmount = 0.0;
            $code = $data['coupon_code'] ?? $cart->coupon?->code;

            if (! empty($code)) {
                // Row lock serialises concurrent redemptions of the same coupon.
                $coupon = Coupon::query()->lockForUpdate()->where('code', $code)->first();

                $reason = $coupon
                    ? $coupon->rejectionReason($subtotal, $user->id)
                    : 'Coupon code not found or inactive.';

                if ($reason !== null) {
                    return response()->json(['message' => $reason, 'errors' => ['coupon_code' => [$reason]]], 422);
                }

                $discountAmount = $coupon->discountFor($subtotal);
            }

            $settings = StoreSetting::query()->first();

            if ($settings && $subtotal < (float) $settings->min_order_amount) {
                return response()->json(['message' => 'Order subtotal is below the store minimum.'], 422);
            }

            $accepts = $data['order_type'] === 'delivery'
                ? ($settings?->accepts_delivery ?? true)
                : ($settings?->accepts_pickup ?? true);

            if (! $accepts) {
                return response()->json(['message' => 'The store does not accept '.$data['order_type'].' orders.'], 422);
            }

            $deliveryFee = $data['order_type'] === 'delivery' ? round((float) ($settings?->delivery_fee ?? 0), 2) : 0.0;
            $taxAmount = round($subtotal * ((float) ($settings?->tax_rate_percent ?? 0) / 100), 2);
            $totalAmount = round($subtotal - $discountAmount + $deliveryFee + $taxAmount, 2);

            $order = Order::create([
                'order_number' => $this->generateOrderNumber(),
                'user_id' => $user->id,
                'address_id' => $data['address_id'] ?? null,
                'order_type' => $data['order_type'],
                'status' => Order::STATUS_PENDING,
                'payment_status' => 'unpaid',
                'payment_method' => null,
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'delivery_fee' => $deliveryFee,
                'tax_amount' => $taxAmount,
                'total_amount' => $totalAmount,
                'coupon_id' => $coupon?->id,
                'notes' => $data['notes'] ?? null,
                'scheduled_for' => $data['scheduled_for'] ?? null,
                'placed_at' => now(),
            ]);

            // Snapshot freshly priced lines into order items.
            foreach ($priced['lines'] as $line) {
                $orderItem = $order->orderItems()->create([
                    'menu_item_id' => $line['menu_item']->id,
                    'item_name' => $line['menu_item']->name,
                    'unit_price' => $line['unit_price'],
                    'quantity' => $line['quantity'],
                    'subtotal' => $line['line_total'],
                    'notes' => $line['cart_item']->notes,
                ]);

                foreach ($line['options'] as $option) {
                    $orderItem->options()->create([
                        'option_name' => $option['option_name'],
                        'price_delta' => $option['price_delta'],
                    ]);
                }
            }

            // Clear the cart after ordering
            $cart->cartItems()->delete();
            $cart->update(['address_id' => null, 'coupon_id' => null]);

            // Record initial status
            $order->statusHistory()->create([
                'status' => Order::STATUS_PENDING,
                'changed_by' => $user->id,
                'note' => 'Order placed.',
            ]);

            if ($coupon) {
                CouponRedemption::create([
                    'coupon_id' => $coupon->id,
                    'user_id' => $user->id,
                    'order_id' => $order->id,
                ]);
            }

            $order->load(['orderItems.options', 'coupon', 'address']);

            return response()->json(['data' => $order], 201);
        });
    }
    /**
     * PUT /api/admin/orders/{order}/status - change order status (staff/admin).
     */
    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        if (! $request->user()->isStaff()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'status' => ['required', 'in:pending,confirmed,preparing,ready,out_for_delivery,completed,cancelled'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        if ($data['status'] !== $order->status
            && ! in_array($data['status'], self::STATUS_TRANSITIONS[$order->status] ?? [], true)) {
            return response()->json([
                'message' => "Cannot move an order from {$order->status} to {$data['status']}.",
            ], 422);
        }

        $order->update(['status' => $data['status']]);

        $order->statusHistory()->create([
            'status' => $data['status'],
            'changed_by' => $request->user()->id,
            'note' => $data['note'] ?? null,
        ]);

        return response()->json(['data' => $order]);
    }

    /**
     * Collision-safe order number. Retrying inside a Postgres transaction
     * after a unique violation is impossible (the transaction is aborted),
     * so the candidate is checked before insert and the unique index on
     * orders.order_number stays as the backstop.
     */
    private function generateOrderNumber(): string
    {
        do {
            $number = 'ORD-'.now()->format('Ymd').'-'.strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
        } while (Order::where('order_number', $number)->exists());

        return $number;
    }
}