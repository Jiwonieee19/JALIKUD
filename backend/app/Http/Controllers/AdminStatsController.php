<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use App\Models\Order;
use App\Models\RiderProfile;
use App\Models\StoreSetting;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Aggregate dashboard numbers for the admin web SPA.
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

    /**
     * GET /api/admin/overview - the "today" snapshot the Dashboard renders.
     */
    public function overview(): JsonResponse
    {
        $todayStart = now()->startOfDay();

        $revenueToday = (float) Order::query()
            ->where('placed_at', '>=', $todayStart)
            ->where('status', '!=', Order::STATUS_CANCELLED)
            ->sum('total_amount');

        $ordersToday = Order::query()->where('placed_at', '>=', $todayStart)->count();
        $completedToday = Order::query()->where('placed_at', '>=', $todayStart)->where('status', Order::STATUS_COMPLETED)->count();
        $cancelledToday = Order::query()->where('placed_at', '>=', $todayStart)->where('status', Order::STATUS_CANCELLED)->count();
        $activeOrders = Order::query()->whereIn('status', [
            Order::STATUS_PENDING,
            Order::STATUS_CONFIRMED,
            Order::STATUS_PREPARING,
            Order::STATUS_READY,
            Order::STATUS_OUT_FOR_DELIVERY,
        ])->count();
        $pendingOrders = Order::query()->where('status', Order::STATUS_PENDING)->count();

        $totalRiders = User::where('role', User::ROLE_RIDER)->count();
        $activeRiderIds = RiderProfile::where('is_active', true)->pluck('user_id')->all();
        $onDeliveryRiderIds = Order::query()
            ->where('status', Order::STATUS_OUT_FOR_DELIVERY)
            ->whereNotNull('rider_id')
            ->pluck('rider_id')
            ->unique()
            ->all();

        $ridersOnDelivery = count($onDeliveryRiderIds);
        $ridersAvailable = count(array_diff($activeRiderIds, $onDeliveryRiderIds));
        $ridersOffline = max(0, $totalRiders - $ridersAvailable - $ridersOnDelivery);

        return response()->json([
            'data' => [
                'revenue_today' => number_format($revenueToday, 2, '.', ''),
                'orders_today' => $ordersToday,
                'active_orders' => $activeOrders,
                'completed_today' => $completedToday,
                'cancelled_today' => $cancelledToday,
                'pending_orders' => $pendingOrders,
                'sold_out_items' => MenuItem::where('is_available', false)->count(),
                'menu_items_total' => MenuItem::count(),
                'riders_available' => $ridersAvailable,
                'riders_on_delivery' => $ridersOnDelivery,
                'riders_offline' => $ridersOffline,
                'store_open' => StoreSetting::isOpenNow(),
                'generated_at' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * GET /api/admin/overview/revenue - 7-day revenue series for the chart.
     */
    public function revenueSeries(): JsonResponse
    {
        $start = now()->subDays(6)->startOfDay();

        $orders = Order::query()
            ->where('placed_at', '>=', $start)
            ->where('status', '!=', Order::STATUS_CANCELLED)
            ->get(['placed_at', 'total_amount']);

        $byDate = $orders->groupBy(fn (Order $order) => $order->placed_at->format('Y-m-d'));

        $series = collect(range(0, 6))->map(function (int $offset) use ($start, $byDate) {
            $date = $start->copy()->addDays($offset)->format('Y-m-d');
            $group = $byDate->get($date, collect());

            return [
                'date' => $date,
                'revenue' => number_format((float) $group->sum('total_amount'), 2, '.', ''),
                'orders' => $group->count(),
            ];
        })->values();

        return response()->json(['data' => $series]);
    }
}

