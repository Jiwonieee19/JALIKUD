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

    public function test_staff_cannot_mutate_payment_records(): void
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
        ])->assertStatus(405);

        $this->putJson("/api/admin/orders/{$order->id}/payment", ['payment_status' => 'paid'])
            ->assertNotFound();
        $this->assertSame(Order::PAYMENT_UNPAID, $order->fresh()->payment_status);
        $this->assertDatabaseMissing('payments', ['order_id' => $order->id]);
    }

    public function test_customer_has_no_payment_mutation_endpoint(): void
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
        ])->assertStatus(405);
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
