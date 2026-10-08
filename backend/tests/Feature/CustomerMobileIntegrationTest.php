<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\StoreSetting;
use App\Models\User;
use App\Models\VariantGroup;
use App\Models\VariantOption;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerMobileIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_cart_endpoints_return_the_same_authoritative_pricing_shape(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        StoreSetting::create([
            'store_name' => 'JALIKUD',
            'is_open' => true,
            'delivery_fee' => 50,
            'tax_rate_percent' => 12,
        ]);

        $item = $this->menuItem();
        $option = $this->variantOption($item);

        $added = $this->postJson('/api/cart/items', [
            'menu_item_id' => $item->id,
            'quantity' => 2,
            'options' => [['variant_option_id' => $option->id]],
        ])->assertCreated()
            ->assertJsonPath('data.cart_items.0.unit_price', '100.00')
            ->assertJsonPath('data.cart_items.0.options.0.price_delta', '25.00')
            ->assertJsonPath('data.cart_items.0.line_total', '250.00')
            ->assertJsonPath('data.subtotal', '250.00')
            ->assertJsonPath('data.discount_amount', '0.00')
            ->assertJsonPath('data.delivery_fee', '50.00')
            ->assertJsonPath('data.tax_amount', '30.00')
            ->assertJsonPath('data.total_amount', '330.00')
            ->assertJsonPath('data.pricing_errors', []);

        $cartId = $added->json('data.id');
        $cartItemId = $added->json('data.cart_items.0.id');

        // Catalog prices, rather than stale cart snapshots, remain authoritative.
        $item->update(['base_price' => 120]);
        $option->update(['price_delta' => 30]);

        $this->getJson('/api/cart')
            ->assertOk()
            ->assertJsonPath('data.cart_items.0.unit_price', '120.00')
            ->assertJsonPath('data.cart_items.0.options.0.price_delta', '30.00')
            ->assertJsonPath('data.cart_items.0.line_total', '300.00')
            ->assertJsonPath('data.total_amount', '386.00');

        $this->putJson("/api/cart/items/{$cartId}/{$cartItemId}", ['quantity' => 1])
            ->assertOk()
            ->assertJsonPath('data.cart_items.0.line_total', '150.00')
            ->assertJsonPath('data.subtotal', '150.00')
            ->assertJsonPath('data.total_amount', '218.00');

        $coupon = Coupon::create([
            'code' => 'SAVE10',
            'type' => 'percentage',
            'value' => 10,
            'min_order_amount' => 100,
            'is_active' => true,
        ]);

        $this->postJson('/api/cart/coupon', ['code' => $coupon->code])
            ->assertOk()
            ->assertJsonPath('data.coupon.code', 'SAVE10')
            ->assertJsonPath('data.discount_amount', '15.00')
            ->assertJsonPath('data.total_amount', '203.00');

        $this->deleteJson("/api/cart/items/{$cartId}/{$cartItemId}")
            ->assertOk()
            ->assertJsonPath('data.cart_items', [])
            ->assertJsonPath('data.subtotal', '0.00')
            ->assertJsonPath('data.total_amount', '50.00');

        $this->deleteJson('/api/cart')
            ->assertOk()
            ->assertJsonPath('data.coupon', null)
            ->assertJsonPath('data.total_amount', '50.00');
    }

    public function test_coupon_application_enforces_the_authoritative_cart_subtotal(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $item = $this->menuItem();
        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])->assertCreated();

        $coupon = Coupon::create([
            'code' => 'MINIMUM',
            'type' => 'fixed',
            'value' => 10,
            'min_order_amount' => 500,
            'is_active' => true,
        ]);

        $this->postJson('/api/cart/coupon', ['code' => $coupon->code])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Order subtotal does not meet the coupon minimum.');
    }

    public function test_customer_order_index_includes_only_its_safe_mobile_card_relations(): void
    {
        $customer = User::factory()->create();
        $other = User::factory()->create();
        Sanctum::actingAs($customer);

        $address = $customer->addresses()->create([
            'label' => 'Home',
            'line1' => '1 Main Street',
            'city' => 'Cebu City',
        ]);
        $order = $this->order($customer, $address->id, 'ORD-MOBILE-1');
        $order->orderItems()->create([
            'item_name' => 'Chicken Adobo',
            'unit_price' => 100,
            'quantity' => 2,
            'subtotal' => 200,
        ]);
        $this->order($other, null, 'ORD-PRIVATE-1');

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.order_number', 'ORD-MOBILE-1')
            ->assertJsonPath('data.0.address.line1', '1 Main Street')
            ->assertJsonPath('data.0.order_items.0.item_name', 'Chicken Adobo')
            ->assertJsonPath('data.0.order_items.0.quantity', 2)
            ->assertJsonMissingPath('data.0.address.latitude')
            ->assertJsonMissingPath('data.0.user');
    }

    private function menuItem(): MenuItem
    {
        $category = Category::create(['name' => 'Mains', 'slug' => 'mains']);

        return MenuItem::create([
            'category_id' => $category->id,
            'name' => 'Chicken Adobo',
            'slug' => 'chicken-adobo',
            'base_price' => 100,
            'is_available' => true,
        ]);
    }

    private function variantOption(MenuItem $item): VariantOption
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
            'price_delta' => 25,
        ]);
    }

    private function order(User $user, ?int $addressId, string $number): Order
    {
        return Order::create([
            'order_number' => $number,
            'user_id' => $user->id,
            'address_id' => $addressId,
            'order_type' => $addressId ? 'delivery' : 'pickup',
            'status' => Order::STATUS_PENDING,
            'subtotal' => 200,
            'total_amount' => 200,
            'placed_at' => now(),
        ]);
    }
}
