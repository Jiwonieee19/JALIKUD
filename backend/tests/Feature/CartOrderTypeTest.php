<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\StoreSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CartOrderTypeTest extends TestCase
{
    use RefreshDatabase;

    public function test_cart_update_flips_order_type_and_recalculates_delivery_fee(): void
    {
        StoreSetting::create([
            'store_name' => 'JALIKUD',
            'is_open' => true,
            'delivery_fee' => 49,
            'tax_rate_percent' => 12,
            'accepts_delivery' => true,
            'accepts_pickup' => true,
        ]);

        $user = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        Sanctum::actingAs($user);

        $category = Category::create(['name' => 'Mains', 'slug' => 'mains-'.Str::random(6)]);
        $item = MenuItem::create([
            'category_id' => $category->id,
            'name' => 'Adobo',
            'slug' => 'adobo-'.Str::random(6),
            'base_price' => 100,
            'is_available' => true,
        ]);

        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])->assertStatus(201);

        // Default cart is delivery: delivery fee + tax applied.
        $delivery = $this->getJson('/api/cart')->json('data');
        $this->assertSame('49.00', $delivery['delivery_fee']);
        $this->assertSame('161.00', $delivery['total_amount']);

        // Flip to pickup: delivery fee must drop to zero.
        $pickup = $this->patchJson('/api/cart', ['order_type' => 'pickup'])->assertOk()->json('data');
        $this->assertSame('pickup', $pickup['order_type']);
        $this->assertSame('0.00', $pickup['delivery_fee']);
        $this->assertSame('112.00', $pickup['total_amount']);
    }
}
