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

    public function test_adding_the_same_item_twice_merges_into_one_row(): void
    {
        $this->actor();
        $item = $this->menuItem(99.0);

        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 2])->assertStatus(201);
        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])->assertOk();

        $response = $this->getJson('/api/cart')->assertOk();
        $response->assertJsonCount(1, 'data.cart_items');
        $response->assertJsonPath('data.cart_items.0.quantity', 3);
        $response->assertJsonPath('data.subtotal', '297.00');
    }

    public function test_same_item_with_different_options_stays_on_separate_rows(): void
    {
        $this->actor();
        $item = $this->menuItem(100.0);
        $large = $this->sizeOption($item, 25.0);

        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])->assertStatus(201);
        $this->postJson('/api/cart/items', [
            'menu_item_id' => $item->id,
            'quantity' => 1,
            'options' => [['variant_option_id' => $large->id]],
        ])->assertStatus(201);

        $this->getJson('/api/cart')->assertOk()->assertJsonCount(2, 'data.cart_items');
    }

    public function test_get_cart_heals_pre_existing_duplicate_rows(): void
    {
        $user = $this->actor();
        $item = $this->menuItem(99.0);

        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 2])->assertStatus(201);

        // Simulate a cart split before merge-on-add existed: identical twin row.
        $cart = \App\Models\Cart::where('user_id', $user->id)->firstOrFail();
        \App\Models\CartItem::create([
            'cart_id' => $cart->id,
            'menu_item_id' => $item->id,
            'quantity' => 1,
            'unit_price' => 99,
        ]);

        $response = $this->getJson('/api/cart')->assertOk();
        $response->assertJsonCount(1, 'data.cart_items');
        $response->assertJsonPath('data.cart_items.0.quantity', 3);
    }

    public function test_cart_serialize_keeps_subtotal_delivery_tax_and_total_consistent(): void
    {
        $this->actor();
        $item = $this->menuItem(100.0);

        \App\Models\StoreSetting::create([
            'store_name' => 'JALIKUD',
            'is_open' => true,
            'delivery_fee' => 49,
            'tax_rate_percent' => 12,
        ]);

        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 2])->assertStatus(201);

        $response = $this->getJson('/api/cart')->assertOk();
        $data = $response->json('data');

        // subtotal must equal the sum of the priced lines — a zero subtotal
        // with priced lines means a stale/mixed payload, never fresh output.
        $lineSum = round(collect($data['cart_items'])->sum(fn ($line) => (float) $line['line_total']), 2);
        $this->assertSame(200.0, $lineSum);
        $this->assertSame('200.00', $data['subtotal']);
        $this->assertSame('49.00', $data['delivery_fee']);
        $this->assertSame('24.00', $data['tax_amount']);
        $this->assertSame('273.00', $data['total_amount']);
        $this->assertSame([], $data['pricing_errors']);
    }

    public function test_cart_lines_keep_oldest_first_order_across_quantity_updates(): void
    {
        $this->actor();
        $first = $this->menuItem(99.0);
        $second = $this->menuItem(150.0);

        $this->postJson('/api/cart/items', ['menu_item_id' => $first->id, 'quantity' => 1])->assertStatus(201);
        $this->postJson('/api/cart/items', ['menu_item_id' => $second->id, 'quantity' => 1])->assertStatus(201);

        $ids = fn () => collect($this->getJson('/api/cart')->assertOk()->json('data.cart_items'))->pluck('id')->all();
        $original = $ids();

        $this->assertCount(2, $original);

        // Bump the first line, then re-add the second: order must not swap.
        $cartId = \App\Models\Cart::firstOrFail()->id;
        $this->putJson("/api/cart/items/{$cartId}/{$original[0]}", ['quantity' => 3])->assertOk();
        $this->assertSame($original, $ids());

        $this->postJson('/api/cart/items', ['menu_item_id' => $second->id, 'quantity' => 1])->assertOk();
        $ordered = $this->getJson('/api/cart')->assertOk()->json('data.cart_items');

        $this->assertSame($original, collect($ordered)->pluck('id')->all());
        $this->assertSame(3, $ordered[0]['quantity']);
        $this->assertSame(2, $ordered[1]['quantity']);
    }

    public function test_cart_reports_zeroed_totals_with_errors_when_item_was_removed(): void
    {
        $this->actor();
        $item = $this->menuItem(199.0);

        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])->assertStatus(201);

        // Realistic removal path: admin DELETE soft-deletes (FK-safe), the
        // seeder force-deletes only after clearing cart lines. Either way the
        // priced cart must explain the zeroed totals instead of going silent.
        $item->delete();

        $response = $this->getJson('/api/cart')->assertOk();
        $response->assertJsonPath('data.subtotal', '0.00');
        $response->assertJsonPath('data.cart_items.0.line_total', '0.00');
        $response->assertJsonCount(1, 'data.pricing_errors');
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
