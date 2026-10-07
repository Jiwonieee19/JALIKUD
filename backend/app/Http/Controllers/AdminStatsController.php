<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use App\Models\Order;
use App\Models\RiderProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * GET /api/admin/stats - aggregate dashboard numbers.
 */
class AdminStatsController extends Controller
{
    public function index(): JsonResponse
    {
        $revenue = (float) Order::query()
            ->where('status', Order::STATUS_COMPLETED)
            ->where('payment_status', Order::PAYMENT_PAID)
            ->sum('total_amount');

        $ordersByStatus = Order::query()
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        return response()->json([
            'data' => [
                'revenue' => number_format($revenue, 2, '.', ''),
                'orders_by_status' => $ordersByStatus,
                'total_orders' => Order::count(),
                'total_customers' => User::where('role', User::ROLE_CUSTOMER)->count(),
                'total_staff' => User::where('role', User::ROLE_STAFF)->count(),
                'total_riders' => User::where('role', User::ROLE_RIDER)->count(),
                'active_riders' => RiderProfile::where('is_active', true)->count(),
                'menu_items_available' => MenuItem::where('is_available', true)->count(),
                'menu_items_total' => MenuItem::count(),
            ],
        ]);
    }
}
