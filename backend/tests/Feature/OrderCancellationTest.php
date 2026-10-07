<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderCancellationTest extends TestCase
{
    use RefreshDatabase;

    private function order(User $customer, string $status): Order
    {
        return Order::create([
            'order_number' => 'ORD-'.strtoupper(Str::random(8)),
            'user_id' => $customer->id,
            'order_type' => 'pickup',
            'status' => $status,
            'subtotal' => 100,
            'total_amount' => 100,
        ]);
    }

    public function test_customer_can_cancel_their_pending_order(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $order = $this->order($customer, Order::STATUS_PENDING);
        Sanctum::actingAs($customer);

        $this->postJson("/api/orders/{$order->id}/cancel")->assertOk();
        $this->assertSame(Order::STATUS_CANCELLED, $order->fresh()->status);
        $this->assertSame(1, $order->statusHistory()->count());
    }

    public function test_customer_cannot_cancel_someone_elses_order(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $other = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $order = $this->order($other, Order::STATUS_PENDING);
        Sanctum::actingAs($customer);

        $this->postJson("/api/orders/{$order->id}/cancel")->assertStatus(403);
    }

    public function test_customer_cannot_cancel_an_order_that_is_preparing(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $order = $this->order($customer, Order::STATUS_PREPARING);
        Sanctum::actingAs($customer);

        $this->postJson("/api/orders/{$order->id}/cancel")->assertStatus(422);
        $this->assertSame(Order::STATUS_PREPARING, $order->fresh()->status);
    }
}
