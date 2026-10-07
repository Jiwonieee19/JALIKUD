<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\PaginationRequest;
use App\Models\Order;
use App\Models\RiderProfile;
use App\Services\PointLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The authenticated rider's own delivery queue. Riders see only orders
 * assigned to them and may advance just the delivery leg:
 * ready -> out_for_delivery -> completed. Kitchen states stay staff-only.
 */
class RiderDeliveryController extends Controller
{
    private const RIDER_TRANSITIONS = [
        Order::STATUS_READY => [Order::STATUS_OUT_FOR_DELIVERY],
        Order::STATUS_OUT_FOR_DELIVERY => [Order::STATUS_COMPLETED],
    ];

    public function index(Request $request, PaginationRequest $pagination): JsonResponse
    {
        $orders = Order::query()
            ->where('rider_id', $request->user()->id)
            ->with([
                'user:id,name,phone',
                'address:id,label,line1,line2,city,state,postal_code,country,latitude,longitude,is_default',
                'orderItems:id,order_id,item_name,quantity,subtotal',
            ])
            ->orderByDesc('placed_at')
            ->paginate($pagination->perPage(15));

        return response()->json(['data' => $orders]);
    }

    public function show(Request $request, int $order): JsonResponse
    {
        $record = Order::query()
            ->where('id', $order)
            ->where('rider_id', $request->user()->id)
            ->with(['user:id,name,phone', 'address', 'orderItems.options', 'statusHistory', 'coupon'])
            ->firstOrFail();

        return response()->json(['data' => $record]);
    }

    /**
     * PUT /api/rider/availability - set own duty status. Only on-duty
     * riders are assignable by staff.
     */
    public function updateAvailability(Request $request): JsonResponse
    {
        $data = $request->validate([
            'is_available' => ['required', 'boolean'],
        ]);

        $profile = RiderProfile::updateOrCreate(
            ['user_id' => $request->user()->id],
            ['is_active' => $data['is_available']],
        );

        return response()->json(['data' => $profile]);
    }

    public function updateStatus(Request $request, int $order): JsonResponse
    {
        $record = Order::query()
            ->where('id', $order)
            ->where('rider_id', $request->user()->id)
            ->firstOrFail();

        $data = $request->validate([
            'status' => ['required', 'in:out_for_delivery,completed'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $allowed = self::RIDER_TRANSITIONS[$record->status] ?? [];

        if ($data['status'] === $record->status || ! in_array($data['status'], $allowed, true)) {
            return response()->json([
                'message' => "Cannot move an order from {$record->status} to {$data['status']}.",
            ], 422);
        }

        $record->update(['status' => $data['status']]);

        $record->statusHistory()->create([
            'status' => $data['status'],
            'changed_by' => $request->user()->id,
            'note' => $data['note'] ?? null,
        ]);

        if ($data['status'] === Order::STATUS_COMPLETED) {
            PointLedger::awardForOrder($record->fresh());
        }

        return response()->json(['data' => $record->fresh()]);
    }
}
