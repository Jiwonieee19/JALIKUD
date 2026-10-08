<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\PaginationRequest;
use App\Models\Cart;
use App\Models\Order;
use App\Models\PointTransaction;
use App\Models\Reward;
use App\Services\PointLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Admin surface for the loyalty catalogue and ledger. The customer-facing
 * catalogue (GET /api/rewards) reads the same rewards table through
 * PointLedger::definitions().
 */
class AdminRewardController extends Controller
{
    public function index(): JsonResponse
    {
        $rewards = Reward::with('menuItem:id,name,slug')->orderBy('id')->get();

        return response()->json(['data' => $rewards]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'key' => ['required', 'string', 'max:50', 'unique:rewards,key'],
            'label' => ['required', 'string', 'max:120'],
            'type' => ['required', 'in:free_item,voucher'],
            'points_cost' => ['required', 'integer', 'min:0'],
            'menu_item_id' => ['nullable', 'integer', 'exists:menu_items,id'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
        ]);

        $this->enforceTypeRequirements($data);

        $reward = Reward::create($data);
        PointLedger::flushDefinitions();

        return response()->json(['data' => $reward->load('menuItem:id,name,slug')], 201);
    }

    public function update(Request $request, Reward $reward): JsonResponse
    {
        $data = $request->validate([
            'label' => ['sometimes', 'string', 'max:120'],
            'type' => ['sometimes', 'in:free_item,voucher'],
            'points_cost' => ['sometimes', 'integer', 'min:0'],
            'menu_item_id' => ['nullable', 'integer', 'exists:menu_items,id'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
        ]);

        // Validate against the merged (existing + submitted) state so partial
        // updates can't leave a reward in an inconsistent shape.
        $this->enforceTypeRequirements(array_merge(
            $reward->only(['type', 'menu_item_id', 'discount_amount', 'min_order_amount']),
            $data,
        ));

        $reward->update($data);
        PointLedger::flushDefinitions();

        return response()->json(['data' => $reward->load('menuItem:id,name,slug')]);
    }

    public function destroy(Reward $reward): JsonResponse
    {
        $referenced = Cart::where('reward_key', $reward->key)->exists()
            || Order::where('reward_key', $reward->key)->exists();

        if ($referenced) {
            return response()->json([
                'message' => 'This reward is referenced by an existing cart or order and cannot be deleted.',
            ], 409);
        }

        $reward->delete();
        PointLedger::flushDefinitions();

        return response()->json(['message' => 'Reward deleted.']);
    }

    /**
     * GET /api/admin/rewards/redemptions - who spent points on a reward.
     * Rewards are spent instantly at checkout, so "redemptions" is served from
     * the ledger rather than a separate table.
     */
    public function redemptions(PaginationRequest $request): JsonResponse
    {
        $redemptions = PointTransaction::query()
            ->where('reason', PointTransaction::REASON_SPENT)
            ->with(['user:id,name,email', 'order:id,order_number,reward_key,total_amount'])
            ->orderByDesc('id')
            ->paginate($request->perPage(15));

        return $this->paginated($redemptions);
    }

    /**
     * GET /api/admin/points - full ledger across all customers.
     */
    public function points(PaginationRequest $request): JsonResponse
    {
        $ledger = PointTransaction::query()
            ->with(['user:id,name,email', 'order:id,order_number'])
            ->orderByDesc('id')
            ->paginate($request->perPage(15));

        return $this->paginated($ledger);
    }

    private function enforceTypeRequirements(array $data): void
    {
        if (($data['type'] ?? null) === 'free_item' && empty($data['menu_item_id'])) {
            throw ValidationException::withMessages([
                'menu_item_id' => ['menu_item_id is required for free_item rewards.'],
            ]);
        }

        if (($data['type'] ?? null) === 'voucher' && empty($data['discount_amount'])) {
            throw ValidationException::withMessages([
                'discount_amount' => ['discount_amount is required for voucher rewards.'],
            ]);
        }
    }
}
