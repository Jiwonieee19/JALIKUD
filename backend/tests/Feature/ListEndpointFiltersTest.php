<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Acceptance coverage for the API-contract handoff: normalised list envelope
 * plus the search / filter query params the admin dashboard sends.
 */
class ListEndpointFiltersTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN]);
    }

    private function menuItem(string $name, ?string $sku = null): MenuItem
    {
        $category = Category::create(['name' => 'Mains', 'slug' => 'mains-'.Str::random(6)]);

        return MenuItem::create([
            'category_id' => $category->id,
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::random(6),
            'sku' => $sku,
            'base_price' => 100,
            'is_available' => true,
        ]);
    }

    public function test_paginated_envelope_is_data_array_plus_meta(): void
    {
        $this->menuItem('Chicken Adobo');
        $this->menuItem('Beef Steak');

        $response = $this->getJson('/api/menu?per_page=5')->assertOk();

        $this->assertIsArray($response->json('data'));
        $this->assertArrayHasKey('meta', $response->json());
        $this->assertSame(2, $response->json('meta.total'));
        $this->assertSame(1, $response->json('meta.current_page'));
        $this->assertSame(5, $response->json('meta.per_page'));
    }

    public function test_menu_search_matches_sku(): void
    {
        $this->menuItem('Chicken Adobo', 'CJ-001');
        $this->menuItem('Beef Steak', 'CJ-002');

        $this->getJson('/api/menu?search=CJ-002')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Beef Steak');
    }

    public function test_coupon_search_matches_code(): void
    {
        Coupon::create(['code' => 'WELCOME10', 'type' => 'fixed', 'value' => 10, 'is_active' => true]);
        Coupon::create(['code' => 'JALIKUD50', 'type' => 'percentage', 'value' => 50, 'is_active' => true]);
        Sanctum::actingAs($this->admin());

        $this->getJson('/api/admin/coupons?search=JALI')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'JALIKUD50');
    }

    public function test_order_list_filters_by_type_status_and_search(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        Order::create(['order_number' => 'ORD-DEL-1', 'user_id' => $customer->id, 'order_type' => 'delivery', 'status' => Order::STATUS_PENDING, 'subtotal' => 100, 'total_amount' => 100]);
        Order::create(['order_number' => 'ORD-PICK-1', 'user_id' => $customer->id, 'order_type' => 'pickup', 'status' => Order::STATUS_COMPLETED, 'subtotal' => 100, 'total_amount' => 100]);
        Sanctum::actingAs($this->admin());

        $this->getJson('/api/admin/orders?order_type=pickup')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.order_number', 'ORD-PICK-1');

        $this->getJson('/api/admin/orders?status=completed')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.order_number', 'ORD-PICK-1');

        $this->getJson('/api/admin/orders?search=ORD-DEL')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.order_number', 'ORD-DEL-1');
    }
}
