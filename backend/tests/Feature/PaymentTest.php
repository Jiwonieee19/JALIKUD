<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_record_payment_and_order_becomes_paid(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $order = Order::create([
            'order_number' => 'ORD-PAY-1',
            'user_id' => $customer->id,
            'order_type' => 'pickup',
            'status' => Order::STATUS_COMPLETED,
            'subtotal' => 500,
            'total_amount' => 500,
        ]);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_STAFF]));

        $this->postJson("/api/admin/orders/{$order->id}/payments", [
            'provider' => 'gcash',
            'amount' => 500,
            'status' => 'succeeded',
        ])->assertStatus(201);

        $this->assertSame(Order::PAYMENT_PAID, $order->fresh()->payment_status);
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'status' => 'succeeded']);
        // completed + paid => loyalty points awarded
        $this->assertDatabaseHas('point_transactions', ['order_id' => $order->id, 'reason' => 'earned']);
    }

    public function test_customer_cannot_record_payment(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $order = Order::create([
            'order_number' => 'ORD-PAY-2',
            'user_id' => $customer->id,
            'order_type' => 'pickup',
            'status' => Order::STATUS_PENDING,
            'subtotal' => 100,
            'total_amount' => 100,
        ]);
        Sanctum::actingAs($customer);

        $this->postJson("/api/admin/orders/{$order->id}/payments", [
            'provider' => 'gcash',
            'amount' => 100,
        ])->assertStatus(403);
    }

    public function test_staff_can_list_payments_for_an_order(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        $order = Order::create([
            'order_number' => 'ORD-PAY-3',
            'user_id' => $customer->id,
            'order_type' => 'pickup',
            'status' => Order::STATUS_PENDING,
            'subtotal' => 100,
            'total_amount' => 100,
        ]);
        $order->payments()->create(['provider' => 'cod', 'amount' => 100, 'status' => 'pending']);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_STAFF]));

        $this->getJson("/api/admin/orders/{$order->id}/payments")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
