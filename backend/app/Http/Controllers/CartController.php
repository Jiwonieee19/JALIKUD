<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\CartItemOption;
use App\Models\Coupon;
use App\Models\MenuItem;
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

    public function addItem(Request $request): JsonResponse
    {
        $data = $request->validate([
            'menu_item_id' => ['required', 'exists:menu_items,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:500'],
            'options' => ['nullable', 'array'],
            'options.*.variant_option_id' => ['required', 'exists:variant_options,id'],
        ]);

        $menuItem = MenuItem::findOrFail($data['menu_item_id']);

        return DB::transaction(function () use ($request, $menuItem, $data) {
            $cart = $this->getCart($request);

            $cartItem = $cart->cartItems()->create([
                'menu_item_id' => $menuItem->id,
                'quantity' => $data['quantity'],
                'unit_price' => $menuItem->base_price,
                'notes' => $data['notes'] ?? null,
            ]);

            if (! empty($data['options'])) {
                foreach ($data['options'] as $option) {
                    $variantOptionId = $option['variant_option_id'];
                    $cartItem->options()->create([
                        'variant_option_id' => $variantOptionId,
                        'price_delta' => 0,
                    ]);
                }
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
            'quantity' => ['sometimes', 'integer', 'min:1'],
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
        return DB::transaction(function () use ($cart, $data) {
            $coupon = Coupon::where('code', $data['code'])
                ->where('is_active', true)
                ->first();

            if (! $coupon) {
                return response()->json(['message' => 'Coupon code not found or inactive.'], 422);
            }

            $cart->update(['coupon_id' => $coupon->id]);
            $cart->load('cartItems.menuItem', 'coupon');

            return response()->json(['data' => $cart]);
        });
    }

    private function getCart(Request $request): Cart
    {
        return Cart::firstOrCreate(
            ['user_id' => $request->user()->id],
            ['session_id' => null, 'order_type' => 'delivery'],
        );
    }
}