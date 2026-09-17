<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\PaginationRequest;
use App\Models\Address;
use App\Models\Cart;
use App\Models\Coupon;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Browse and manage orders for the authenticated user.
 */
class OrderController extends Controller
{
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
     * POST /api/orders — place an order from the current cart.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_type' => ['required', 'in:delivery,pickup'],
            'address_id' => ['nullable', 'exists:addresses,id'],
            'coupon_code' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'scheduled_for' => ['nullable', 'date'],
        ]);

        return DB::transaction(function () use ($request, $data) {
            $user = $request->user();
            $cart = Cart::where('user_id', $user->id)
                ->with(['cartItems.menuItem', 'cartItems.options.variantOption'])
                ->first();

            if (! $cart || $cart->cartItems->isEmpty()) {
                return response()->json(['message' => 'Your cart is empty.'], 422);
            }

            // Calculate totals
            $subtotal = 0;
            foreach ($cart->cartItems as $item) {
                $itemTotal = $item->unit_price * $item->quantity;
                $subtotal += $itemTotal;
            }

            $discountAmount = 0;
            $coupon = null;

            if (! empty($data['coupon_code'])) {
                $coupon = Coupon::where('code', $data['coupon_code'])
                    ->where('is_active', true)
                    ->first();

                if ($coupon && $subtotal >= $coupon->min_order_amount) {
                    if ($coupon->type === 'fixed') {
                        $discountAmount = min($coupon->value, $subtotal);
                    } else {
                        $discountAmount = min($coupon->value / 100 * $subtotal, $coupon->max_discount_amount ?? $subtotal);
                    }
                }
            }

            $settings = \App\Models\StoreSetting::first();
            $deliveryFee = ($data['order_type'] === 'delivery') ? ($settings->delivery_fee ?? 0) : 0;
            $taxAmount = $subtotal * (($settings->tax_rate_percent ?? 0) / 100);
            $totalAmount = $subtotal - $discountAmount + $deliveryFee + $taxAmount;

            $orderNumber = 'ORD-' . now()->format('Ymd') . '-' . str_pad($user->orders()->max('id') + 1, 4, '0', STR_PAD_LEFT);

            $order = Order::create([
                'order_number' => $orderNumber,
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

            // Snapshot cart items into order items
            foreach ($cart->cartItems as $cartItem) {
                $orderItem = $order->orderItems()->create([
                    'menu_item_id' => $cartItem->menu_item_id,
                    'item_name' => $cartItem->menuItem->name,
                    'unit_price' => $cartItem->unit_price,
                    'quantity' => $cartItem->quantity,
                    'subtotal' => $cartItem->unit_price * $cartItem->quantity,
                    'notes' => $cartItem->notes,
                ]);

                foreach ($cartItem->options as $option) {
                    $orderItem->options()->create([
                        'option_name' => $option->variantOption->name ?? 'Option',
                        'price_delta' => $option->price_delta,
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
                \App\Models\CouponRedemption::create([
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
     * PUT /api/admin/orders/{order}/status — change order status (staff/admin).
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

        $order->update(['status' => $data['status']]);

        $order->statusHistory()->create([
            'status' => $data['status'],
            'changed_by' => $request->user()->id,
            'note' => $data['note'],
        ]);

        return response()->json(['data' => $order]);
    }
}