<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\StoreSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The regression this feature was built for: a customer who registers through
 * the public API could previously never place a delivery order, because
 * POST /api/orders demands an `address_id` they own but there was no way to
 * create one. Only seeded accounts (written straight to the database by
 * UserSeeder) could check out for delivery.
 */
class DeliveryCheckoutTest extends TestCase
{
    use RefreshDatabase;

    private function customerWithCart(): User
    {
        $user = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        Sanctum::actingAs($user);

        $category = Category::create(['name' => 'Mains', 'slug' => 'mains-'.Str::random(6)]);
        $item = MenuItem::create([
            'category_id' => $category->id,
            'name' => 'Chicken Adobo',
            'slug' => 'adobo-'.Str::random(6),
            'base_price' => 150,
            'is_available' => true,
        ]);

        StoreSetting::create([
            'store_name' => 'JALIKUD',
            'is_open' => true,
            'min_order_amount' => 0,
            'accepts_delivery' => true,
        ]);

        $this->postJson('/api/cart/items', ['menu_item_id' => $item->id, 'quantity' => 1])
            ->assertStatus(201);

        return $user;
    }

    public function test_delivery_checkout_is_rejected_before_an_address_exists(): void
    {
        $this->customerWithCart();

        // Documents the original gap: this 422 is what a real customer hit.
        $this->postJson('/api/orders', ['order_type' => 'delivery'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['address_id']);
    }

    public function test_a_brand_new_customer_can_now_complete_a_delivery_order(): void
    {
        $user = $this->customerWithCart();

        $addressId = $this->postJson('/api/addresses', [
            'line1' => '123 Katipunan Ave',
            'city' => 'Quezon City',
            'country' => 'Philippines',
        ])->assertStatus(201)->json('data.id');

        $this->postJson('/api/orders', [
            'order_type' => 'delivery',
            'address_id' => $addressId,
        ])->assertStatus(201);

        $this->assertDatabaseHas('orders', [
            'user_id' => $user->id,
            'order_type' => 'delivery',
            'address_id' => $addressId,
        ]);
    }

    public function test_an_address_owned_by_someone_else_is_rejected(): void
    {
        $this->customerWithCart();

        $victim = User::factory()->create();
        $foreign = Address::create([
            'user_id' => $victim->id,
            'line1' => '999 Somewhere St',
            'city' => 'Manila',
        ]);

        // The existing Rule::exists(...)->where('user_id', ...) already scopes to
        // the caller, so a foreign address id must not be usable.
        $this->postJson('/api/orders', [
            'order_type' => 'delivery',
            'address_id' => $foreign->id,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['address_id']);
    }

    public function test_pickup_checkout_still_needs_no_address(): void
    {
        $user = $this->customerWithCart();

        $this->postJson('/api/orders', ['order_type' => 'pickup'])->assertStatus(201);

        $this->assertDatabaseHas('orders', [
            'user_id' => $user->id,
            'order_type' => 'pickup',
            'address_id' => null,
        ]);
    }

    public function test_delivery_defaults_to_unpaid_cod_and_gcash_is_automatically_paid(): void
    {
        $user = $this->customerWithCart();
        $address = Address::create([
            'user_id' => $user->id,
            'line1' => '123 Test Street',
            'city' => 'Davao City',
        ]);

        $this->postJson('/api/orders', [
            'order_type' => 'delivery',
            'address_id' => $address->id,
        ])->assertStatus(201);
        $this->assertDatabaseHas('orders', [
            'user_id' => $user->id,
            'payment_method' => 'cod',
            'payment_status' => 'unpaid',
        ]);

        $this->postJson('/api/cart/items', ['menu_item_id' => MenuItem::first()->id, 'quantity' => 1])
            ->assertStatus(201);
        $gcashOrderId = $this->postJson('/api/orders', ['order_type' => 'pickup', 'payment_method' => 'gcash'])
            ->assertJsonPath('data.payment_status', 'paid')
            ->assertStatus(201);
        $this->assertDatabaseHas('orders', [
            'user_id' => $user->id,
            'payment_method' => 'gcash',
            'payment_status' => 'paid',
        ]);
        $this->assertDatabaseHas('payments', [
            'order_id' => $gcashOrderId->json('data.id'),
            'provider' => 'gcash',
            'status' => 'succeeded',
        ]);
    }

    public function test_pickup_checkout_rejects_cod(): void
    {
        $this->customerWithCart();

        $this->postJson('/api/orders', ['order_type' => 'pickup', 'payment_method' => 'cod'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['payment_method']);
    }

    public function test_checkout_rejects_unknown_payment_method(): void
    {
        $this->customerWithCart();

        $this->postJson('/api/orders', ['order_type' => 'pickup', 'payment_method' => 'card'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['payment_method']);
    }
}
