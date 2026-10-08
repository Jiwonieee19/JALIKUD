<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\PaginationRequest;
use App\Models\Coupon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin CRUD for coupon codes.
 */
class CouponController extends Controller
{
    public function index(PaginationRequest $request): JsonResponse
    {
        $coupons = Coupon::query()
            ->when($request->query('active') === 'true', fn ($q) => $q->where('is_active', true))
            ->orderByDesc('created_at')
            ->paginate($request->perPage(15));

        return response()->json(['data' => $coupons]);
    }

    public function show(Coupon $coupon): JsonResponse
    {
        return response()->json(['data' => $coupon]);
    }

    public function store(Request $request): JsonResponse
    {
        if ($request->has('code')) {
            $request->merge(['code' => strtoupper(trim((string) $request->input('code')))]);
        }

        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', 'regex:/^[A-Z0-9_-]+$/', 'unique:coupons,code'],
            'type' => ['required', 'in:fixed,percentage'],
            'value' => ['required', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'max_discount_amount' => ['nullable', 'numeric', 'min:0'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'usage_limit_per_user' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['boolean'],
        ]);

        $coupon = Coupon::create($data);

        return response()->json(['data' => $coupon], 201);
    }

    public function update(Request $request, Coupon $coupon): JsonResponse
    {
        if ($request->has('code')) {
            $request->merge(['code' => strtoupper(trim((string) $request->input('code')))]);
        }

        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:50', 'regex:/^[A-Z0-9_-]+$/', 'unique:coupons,code,'.$coupon->id],
            'type' => ['sometimes', 'in:fixed,percentage'],
            'value' => ['sometimes', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'max_discount_amount' => ['nullable', 'numeric', 'min:0'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'usage_limit_per_user' => ['nullable', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['boolean'],
        ]);

        $coupon->update($data);

        return response()->json(['data' => $coupon]);
    }

    public function destroy(Coupon $coupon): JsonResponse
    {
        $coupon->delete();

        return response()->json(['message' => 'Coupon deleted.']);
    }

    /**
     * GET /api/admin/coupons/{coupon}/redemptions - who redeemed this coupon.
     */
    public function redemptions(PaginationRequest $request, Coupon $coupon): JsonResponse
    {
        $redemptions = $coupon->redemptions()
            ->with(['user:id,name,email', 'order:id,order_number'])
            ->orderByDesc('id')
            ->paginate($request->perPage(15));

        return response()->json(['data' => $redemptions]);
    }
}
