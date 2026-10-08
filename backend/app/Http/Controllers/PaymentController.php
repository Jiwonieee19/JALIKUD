<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\JsonResponse;

/**
 * Read-only payment history for staff. Payment state changes happen only at
 * GCash checkout or when the assigned rider completes a COD delivery.
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
}
