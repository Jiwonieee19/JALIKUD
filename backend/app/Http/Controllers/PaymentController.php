<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Payment;
use App\Services\PointLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Payment records for an order. Records a payment attempt against the
 * payments table and keeps orders.payment_status in sync; a succeeded payment
 * triggers the loyalty award once the order is also completed.
 */
class PaymentController extends Controller
{
    /**
     * GET /api/admin/orders/{order}/payments
     */
    public function index(Order $order): JsonResponse
    {
        $payments = $order->payments()->orderByDesc('id')->get();

        return response()->json(['data' => $payments]);
    }

    /**
     * POST /api/admin/orders/{order}/payments
     */
    public function store(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['required', 'string', Rule::in(['cod', 'gcash', 'stripe', 'paypal'])],
            'provider_transaction_id' => ['nullable', 'string', 'max:150'],
            'amount' => ['required', 'numeric', 'min:0'],
            'currency' => ['sometimes', 'string', 'max:10'],
            'status' => ['sometimes', 'string', Rule::in(['pending', 'succeeded', 'failed', 'refunded'])],
        ]);

        $status = $data['status'] ?? 'pending';

        $payment = $order->payments()->create([
            'provider' => $data['provider'],
            'provider_transaction_id' => $data['provider_transaction_id'] ?? null,
            'amount' => $data['amount'],
            'currency' => $data['currency'] ?? 'PHP',
            'status' => $status,
            'paid_at' => $status === 'succeeded' ? now() : null,
        ]);

        $this->syncOrderPaymentStatus($order, $status);

        return response()->json(['data' => $payment->fresh()], 201);
    }

    /**
     * PUT/PATCH /api/admin/payments/{payment}
     */
    public function update(Request $request, Payment $payment): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'string', Rule::in(['pending', 'succeeded', 'failed', 'refunded'])],
            'provider_transaction_id' => ['sometimes', 'nullable', 'string', 'max:150'],
        ]);

        $payment->update([
            'status' => $data['status'],
            'provider_transaction_id' => $data['provider_transaction_id'] ?? $payment->provider_transaction_id,
            'paid_at' => $data['status'] === 'succeeded' ? ($payment->paid_at ?? now()) : $payment->paid_at,
        ]);

        $this->syncOrderPaymentStatus($payment->order, $data['status']);

        return response()->json(['data' => $payment->fresh()]);
    }

    /**
     * Map a payment status onto the order's payment_status and, on success,
     * attempt the loyalty award (no-op until the order is also completed).
     */
    private function syncOrderPaymentStatus(Order $order, string $status): void
    {
        $map = [
            'succeeded' => Order::PAYMENT_PAID,
            'refunded' => Order::PAYMENT_REFUNDED,
            'failed' => Order::PAYMENT_FAILED,
            'pending' => Order::PAYMENT_UNPAID,
        ];

        $order->update(['payment_status' => $map[$status] ?? Order::PAYMENT_UNPAID]);

        if ($status === 'succeeded') {
            PointLedger::awardForOrder($order->fresh());
        }
    }
}
