<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Review;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReviewTest extends TestCase
{
    use RefreshDatabase;

    private function completedOrder(User $customer): Order
    {
        return Order::create([
            'order_number' => 'ORD-'.strtoupper(Str::random(8)),
            'user_id' => $customer->id,
            'order_type' => 'pickup',
            'status' => Order::STATUS_COMPLETED,
            'payment_status' => Order::PAYMENT_PAID,
            'subtotal' => 100,
            'total_amount' => 100,
        ]);
    }

    public function test_customer_can_review_their_completed_order(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $order = $this->completedOrder($customer);
        Sanctum::actingAs($customer);

        $this->postJson("/api/orders/{$order->id}/review", [
            'rating' => 5,
            'comment' => 'Great!',
        ])->assertStatus(201)->assertJsonPath('data.rating', 5);
    }

    public function test_customer_cannot_review_someone_elses_order(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $other = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $order = $this->completedOrder($other);
        Sanctum::actingAs($customer);

        $this->postJson("/api/orders/{$order->id}/review", ['rating' => 5])->assertStatus(403);
    }

    public function test_customer_cannot_review_an_incomplete_order(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $order = Order::create([
            'order_number' => 'ORD-'.strtoupper(Str::random(8)),
            'user_id' => $customer->id,
            'order_type' => 'pickup',
            'status' => Order::STATUS_PENDING,
            'subtotal' => 100,
            'total_amount' => 100,
        ]);
        Sanctum::actingAs($customer);

        $this->postJson("/api/orders/{$order->id}/review", ['rating' => 5])->assertStatus(422);
    }

    public function test_public_can_read_menu_item_reviews(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $category = Category::create(['name' => 'Mains', 'slug' => 'mains-'.Str::random(6)]);
        $item = MenuItem::create([
            'category_id' => $category->id,
            'name' => 'Adobo',
            'slug' => 'adobo-'.Str::random(6),
            'base_price' => 100,
            'is_available' => true,
        ]);
        $order = $this->completedOrder($customer);
        Review::create([
            'order_id' => $order->id,
            'user_id' => $customer->id,
            'menu_item_id' => $item->id,
            'rating' => 4,
            'comment' => 'Tasty',
        ]);

        $this->getJson("/api/menu/{$item->id}/reviews")
            ->assertOk()
            ->assertJsonPath('data.count', 1)
            ->assertJsonPath('data.reviews.0.rating', 4);
    }

    public function test_admin_can_list_and_delete_reviews(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $order = $this->completedOrder($customer);
        $review = Review::create([
            'order_id' => $order->id,
            'user_id' => $customer->id,
            'rating' => 3,
        ]);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));

        $this->getJson('/api/admin/reviews')->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/admin/reviews/{$review->id}")->assertOk();
        $this->assertDatabaseMissing('reviews', ['id' => $review->id]);
    }
}
