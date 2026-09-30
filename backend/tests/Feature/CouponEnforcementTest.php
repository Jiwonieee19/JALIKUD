<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Coupon enforcement at apply + redeem time: validity window, global and
 * per-user usage limits, minimum order amount (fail closed, never silently
 * dropped) and discount computation.
 */
class CouponEnforcementTest extends TestCase
{
    use RefreshDatabase;

    private function actor(): User
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        return $user;
    }

    private function addToCart(float $price = 100.0): MenuItem
    {
        $category = Category::create(['name' => 'Mains', 'slug' => 'mains-'.Str::random(6)]);
        $item = MenuItem::create([
            'category_id' => $category->id,
            'name' => 'Pork Sinigang',
            'slug' => 'sinigang-'.Str::random(6),
            'base_price' => $price,
            'is_available' => true,
        ]);

        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])->assertStatus(201);

        return $item;
    }

    private function coupon(array $overrides = []): Coupon
    {
        return Coupon::create(array_merge([
            'code' => 'SAVE'.Str::upper(Str::random(5)),
            'type' => 'fixed',
            'value' => 20,
            'min_order_amount' => 0,
            'is_active' => true,
        ], $overrides));
    }

    public function test_expired_coupon_is_rejected_at_checkout(): void
    {
        $this->actor();
        $this->addToCart();

        $coupon = $this->coupon(['expires_at' => now()->subDay()]);

        $this->postJson('/api/orders', ['order_type' => 'pickup', 'coupon_code' => $coupon->code])
            ->assertStatus(422)
            ->assertJsonValidationErrors('coupon_code');

        $this->assertSame(0, Order::count());
    }

    public function test_coupon_that_has_not_started_yet_is_rejected(): void
    {
        $this->actor();
        $this->addToCart();

        $coupon = $this->coupon(['starts_at' => now()->addDay()]);

        $this->postJson('/api/orders', ['order_type' => 'pickup', 'coupon_code' => $coupon->code])
            ->assertStatus(422);
    }

    public function test_inactive_coupon_is_rejected(): void
    {
        $this->actor();
        $this->addToCart();

        $coupon = $this->coupon(['is_active' => false]);

        $this->postJson('/api/orders', ['order_type' => 'pickup', 'coupon_code' => $coupon->code])
            ->assertStatus(422);
    }

    public function test_global_usage_limit_is_enforced(): void
    {
        $this->actor();
        $this->addToCart();

        $coupon = $this->coupon(['usage_limit' => 1]);

        // Somebody else already consumed the only redemption.
        $otherOrder = Order::create([
            'order_number' => 'ORD-OTHER-1',
            'user_id' => User::factory()->create()->id,
            'order_type' => 'pickup',
            'subtotal' => 100,
            'total_amount' => 100,
        ]);

        CouponRedemption::create([
            'coupon_id' => $coupon->id,
            'user_id' => $otherOrder->user_id,
            'order_id' => $otherOrder->id,
        ]);

        $this->postJson('/api/orders', ['order_type' => 'pickup', 'coupon_code' => $coupon->code])
            ->assertStatus(422);
    }

    public function test_per_user_limit_is_enforced_after_one_redemption(): void
    {
        $this->actor();
        $coupon = $this->coupon(['usage_limit_per_user' => 1]);

        $this->addToCart();
        $this->postJson('/api/orders', ['order_type' => 'pickup', 'coupon_code' => $coupon->code])
            ->assertStatus(201);

        // Same customer, second order: the per-user limit is now exhausted.
        $this->addToCart();
        $this->postJson('/api/orders', ['order_type' => 'pickup', 'coupon_code' => $coupon->code])
            ->assertStatus(422);

        $this->assertSame(1, $coupon->redemptions()->count());
    }

    public function test_coupon_below_minimum_order_amount_fails_closed(): void
    {
        $this->actor();
        $this->addToCart(50.0);

        $coupon = $this->coupon(['min_order_amount' => 500]);

        // Must be rejected instead of silently ordering without the discount.
        $this->postJson('/api/orders', ['order_type' => 'pickup', 'coupon_code' => $coupon->code])
            ->assertStatus(422);

        $this->assertSame(0, Order::count());
    }

    public function test_percentage_discount_is_applied_and_capped(): void
    {
        $this->actor();
        $this->addToCart(100.0);

        $coupon = $this->coupon([
            'type' => 'percentage',
            'value' => 50,
            'max_discount_amount' => 20,
        ]);

        $this->postJson('/api/orders', ['order_type' => 'pickup', 'coupon_code' => $coupon->code])
            ->assertStatus(201);

        $order = Order::first();

        $this->assertSame(20.0, (float) $order->discount_amount);
        $this->assertSame(80.0, (float) $order->total_amount);
        $this->assertSame(1, $coupon->redemptions()->count());
    }

    public function test_apply_coupon_stores_coupon_on_cart_only_when_valid(): void
    {
        $user = $this->actor();

        $this->postJson('/api/cart/coupon', ['code' => 'NOPE'])->assertStatus(422);

        $coupon = $this->coupon();

        $this->postJson('/api/cart/coupon', ['code' => $coupon->code])
            ->assertStatus(200)
            ->assertJsonPath('data.coupon.id', $coupon->id);

        $this->assertSame($coupon->id, \App\Models\Cart::where('user_id', $user->id)->first()->coupon_id);

        $coupon->update(['expires_at' => now()->subDay()]);

        $this->postJson('/api/cart/coupon', ['code' => $coupon->code])->assertStatus(422);
    }
}
