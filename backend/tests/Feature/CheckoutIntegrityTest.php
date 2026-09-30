<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\StoreSetting;
use App\Models\User;
use App\Models\VariantGroup;
use App\Models\VariantOption;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers checkout integrity: server-authoritative pricing (variant deltas),
 * stale-catalog protection, store-hours enforcement, address ownership and
 * status-transition rules.
 */
class CheckoutIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function actor(): User
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        return $user;
    }

    private function menuItem(float $price = 100.0, array $overrides = []): MenuItem
    {
        $category = Category::create(['name' => 'Mains', 'slug' => 'mains-'.Str::random(6)]);

        return MenuItem::create(array_merge([
            'category_id' => $category->id,
            'name' => 'Chicken Adobo',
            'slug' => 'adobo-'.Str::random(6),
            'base_price' => $price,
            'is_available' => true,
        ], $overrides));
    }

    private function sizeOption(MenuItem $item, float $delta = 25.0): VariantOption
    {
        $group = VariantGroup::create([
            'menu_item_id' => $item->id,
            'name' => 'Size',
            'selection_type' => 'single',
            'is_required' => false,
        ]);

        return VariantOption::create([
            'variant_group_id' => $group->id,
            'name' => 'Large',
            'price_delta' => $delta,
        ]);
    }

    public function test_variant_option_price_delta_is_charged_at_checkout(): void
    {
        $this->actor();
        $item = $this->menuItem(100.0);
        $large = $this->sizeOption($item, 25.0);

        $this->postJson('/api/cart/items', [
            'menu_item_id' => $item->id,
            'quantity' => 2,
            'options' => [['variant_option_id' => $large->id]],
        ])->assertStatus(201);

        $this->postJson('/api/orders', ['order_type' => 'pickup'])->assertStatus(201);

        $order = Order::first();

        // (100 + 25) * 2 - the delta must be included in subtotal and totals.
        $this->assertSame(250.0, (float) $order->subtotal);
        $this->assertSame(250.0, (float) $order->total_amount);
        $this->assertSame(250.0, (float) $order->orderItems->first()->subtotal);
        $this->assertSame(25.0, (float) $order->orderItems->first()->options->first()->price_delta);
    }

    public function test_cart_rejects_option_belonging_to_another_item(): void
    {
        $this->actor();
        $item = $this->menuItem(100.0);
        $foreign = $this->sizeOption($this->menuItem(80.0), 10.0);

        $this->postJson('/api/cart/items', [
            'menu_item_id' => $item->id,
            'quantity' => 1,
            'options' => [['variant_option_id' => $foreign->id]],
        ])->assertStatus(422)->assertJsonValidationErrors('options');
    }

    public function test_cart_requires_selection_for_required_group(): void
    {
        $this->actor();
        $item = $this->menuItem();

        VariantGroup::create([
            'menu_item_id' => $item->id,
            'name' => 'Spice Level',
            'selection_type' => 'single',
            'is_required' => true,
        ]);

        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])
            ->assertStatus(422)
            ->assertJsonValidationErrors('options');
    }

    public function test_cart_caps_quantity_at_99(): void
    {
        $this->actor();
        $item = $this->menuItem();

        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 100])
            ->assertStatus(422)
            ->assertJsonValidationErrors('quantity');
    }

    public function test_checkout_fails_closed_when_a_cart_item_became_unavailable(): void
    {
        $user = $this->actor();
        $item = $this->menuItem();

        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])->assertStatus(201);

        $item->update(['is_available' => false]);

        $this->postJson('/api/orders', ['order_type' => 'pickup'])->assertStatus(422);

        $this->assertSame(0, Order::count());
        $this->assertSame(1, \App\Models\Cart::where('user_id', $user->id)->first()->cartItems()->count(), 'cart must be left untouched');
    }

    public function test_checkout_is_rejected_when_store_is_closed(): void
    {
        $this->actor();
        $item = $this->menuItem();
        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])->assertStatus(201);

        StoreSetting::create(['store_name' => 'JALIKUD', 'is_open' => false]);

        $this->postJson('/api/orders', ['order_type' => 'pickup'])->assertStatus(422);
    }

    public function test_checkout_is_rejected_outside_business_hours(): void
    {
        $this->actor();
        $item = $this->menuItem();
        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])->assertStatus(201);

        StoreSetting::create([
            'store_name' => 'JALIKUD',
            'is_open' => true,
            'opening_time' => '09:00:00',
            'closing_time' => '22:00:00',
        ]);

        Carbon::setTestNow('2026-09-30 23:30:00');

        $this->postJson('/api/orders', ['order_type' => 'pickup'])->assertStatus(422);
    }

    public function test_delivery_requires_an_address_that_belongs_to_the_customer(): void
    {
        $this->actor();
        $item = $this->menuItem();
        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])->assertStatus(201);

        $foreignAddress = User::factory()->create()->addresses()->create([
            'label' => 'Not yours',
            'line1' => '1 Elsewhere St',
            'city' => 'Cebu City',
        ]);

        $this->postJson('/api/orders', ['order_type' => 'delivery', 'address_id' => $foreignAddress->id])
            ->assertStatus(422)
            ->assertJsonValidationErrors('address_id');

        $this->assertSame(0, Order::count());
    }

    public function test_delivery_totals_apply_store_fee_and_tax(): void
    {
        $user = $this->actor();
        $item = $this->menuItem(100.0);
        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])->assertStatus(201);

        StoreSetting::create([
            'store_name' => 'JALIKUD',
            'is_open' => true,
            'delivery_fee' => 50,
            'tax_rate_percent' => 12,
        ]);

        $address = $user->addresses()->create([
            'label' => 'Home',
            'line1' => '1 Home St',
            'city' => 'Cebu City',
        ]);

        $this->postJson('/api/orders', ['order_type' => 'delivery', 'address_id' => $address->id])
            ->assertStatus(201);

        $order = Order::first();

        $this->assertSame(100.0, (float) $order->subtotal);
        $this->assertSame(50.0, (float) $order->delivery_fee);
        $this->assertSame(12.0, (float) $order->tax_amount);
        $this->assertSame(162.0, (float) $order->total_amount);
    }

    public function test_order_numbers_are_unique_between_orders(): void
    {
        $this->actor();

        foreach (range(1, 2) as $ignored) {
            $this->postJson('/api/cart/items', ['menu_item_id' => $this->menuItem()->id, 'quantity' => 1])
                ->assertStatus(201);
            $this->postJson('/api/orders', ['order_type' => 'pickup'])->assertStatus(201);
        }

        $this->assertCount(2, Order::pluck('order_number')->unique());
    }

    public function test_admin_status_updates_follow_the_transition_map(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $order = Order::create([
            'order_number' => 'ORD-TEST-0001',
            'user_id' => User::factory()->create()->id,
            'order_type' => 'pickup',
            'status' => Order::STATUS_PENDING,
            'subtotal' => 100,
            'total_amount' => 100,
        ]);

        // pending -> completed is not a legal transition
        $this->putJson("/api/admin/orders/{$order->id}/status", ['status' => Order::STATUS_COMPLETED])
            ->assertStatus(422);

        $this->putJson("/api/admin/orders/{$order->id}/status", ['status' => Order::STATUS_CONFIRMED])
            ->assertStatus(200);

        $this->assertSame(Order::STATUS_CONFIRMED, $order->fresh()->status);
        $this->assertSame(1, $order->statusHistory()->where('status', Order::STATUS_CONFIRMED)->count());
    }
}
