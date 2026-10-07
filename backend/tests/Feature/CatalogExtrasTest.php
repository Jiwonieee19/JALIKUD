<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CatalogExtrasTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN]);
    }

    private function category(string $name = 'Mains'): Category
    {
        return Category::create(['name' => $name, 'slug' => Str::slug($name).'-'.Str::random(6)]);
    }

    public function test_menu_search_filters_by_name(): void
    {
        $category = $this->category();
        MenuItem::create(['category_id' => $category->id, 'name' => 'Chicken Adobo', 'slug' => 'adobo-'.Str::random(6), 'base_price' => 100, 'is_available' => true]);
        MenuItem::create(['category_id' => $category->id, 'name' => 'Beef Steak', 'slug' => 'steak-'.Str::random(6), 'base_price' => 150, 'is_available' => true]);

        $this->getJson('/api/menu?search=adobo')
            ->assertOk()
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.name', 'Chicken Adobo');
    }

    public function test_category_cannot_be_its_own_parent(): void
    {
        $category = $this->category();
        Sanctum::actingAs($this->admin());

        $this->putJson("/api/admin/categories/{$category->id}", ['name' => $category->name, 'parent_id' => $category->id])
            ->assertStatus(422);
    }

    public function test_category_with_menu_items_cannot_be_deleted(): void
    {
        $category = $this->category();
        MenuItem::create(['category_id' => $category->id, 'name' => 'Adobo', 'slug' => 'adobo-'.Str::random(6), 'base_price' => 100]);
        Sanctum::actingAs($this->admin());

        $this->deleteJson("/api/admin/categories/{$category->id}")->assertStatus(422);
    }

    public function test_admin_stats_returns_summary(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        Order::create([
            'order_number' => 'ORD-ST-1',
            'user_id' => $customer->id,
            'order_type' => 'pickup',
            'status' => Order::STATUS_COMPLETED,
            'payment_status' => Order::PAYMENT_PAID,
            'subtotal' => 250,
            'total_amount' => 250,
        ]);
        Sanctum::actingAs($this->admin());

        $this->getJson('/api/admin/stats')
            ->assertOk()
            ->assertJsonPath('data.total_orders', 1)
            ->assertJsonPath('data.revenue', '250.00');
    }
}
