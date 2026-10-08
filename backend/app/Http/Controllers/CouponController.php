<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\PaginationRequest;
use App\Models\Coupon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Admin CRUD for coupon codes.
 */
class CouponController extends Controller
{
    public function index(PaginationRequest $request): JsonResponse
    {
        $coupons = Coupon::query()
            ->withCount('redemptions')
            ->when($request->query('active') === 'true', fn ($q) => $q->where('is_active', true))
            ->when($request->query('search'), fn ($q, $s) => $q->where('code', 'like', "%{$s}%"))
            ->orderByDesc('created_at')
            ->paginate($request->perPage(15));

        return $this->paginated($coupons, fn (Coupon $coupon) => $this->couponData($coupon));
    }

    public function show(Coupon $coupon): JsonResponse
    {
        return response()->json(['data' => $this->couponData($coupon->loadCount('redemptions'))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50', 'unique:coupons,code'],
            'type' => ['required', 'in:fixed,percentage'],
            'value' => ['required', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'max_discount_amount' => ['nullable', 'numeric', 'min:0'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'usage_limit_per_user' => ['sometimes', 'required', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['boolean'],
        ]);

        $coupon = Coupon::create($data)->refresh()->loadCount('redemptions');

        return response()->json(['data' => $this->couponData($coupon)], 201);
    }

    public function update(Request $request, Coupon $coupon): JsonResponse
    {
        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:50', 'unique:coupons,code,'.$coupon->id],
            'type' => ['sometimes', 'in:fixed,percentage'],
            'value' => ['sometimes', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'max_discount_amount' => ['nullable', 'numeric', 'min:0'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
            'usage_limit_per_user' => ['sometimes', 'required', 'integer', 'min:1'],
            'starts_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:starts_at'],
            'is_active' => ['boolean'],
        ]);

        if (array_key_exists('usage_limit', $data) && $data['usage_limit'] !== null) {
            $redemptions = $coupon->redemptions()->count();

            if ((int) $data['usage_limit'] < $redemptions) {
                throw ValidationException::withMessages([
                    'usage_limit' => ["The total redemption quota cannot be lower than {$redemptions} already redeemed."],
                ]);
            }
        }

        $coupon->update($data);
        $coupon->loadCount('redemptions');

        return response()->json(['data' => $this->couponData($coupon)]);
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

        return $this->paginated($redemptions);
    }

    /**
     * Keep the configured quota stable and expose consumption as derived data.
     *
     * @return array<string, mixed>
     */
    private function couponData(Coupon $coupon): array
    {
        $redemptions = (int) ($coupon->getAttribute('redemptions_count') ?? $coupon->redemptions()->count());
        $limit = $coupon->usage_limit;
        $data = $coupon->toArray();
        $data['redemptions_count'] = $redemptions;
        $data['remaining_uses'] = $limit === null ? null : max((int) $limit - $redemptions, 0);

        return $data;
    }
}
