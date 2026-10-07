<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use App\Services\PointLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Customer-facing loyalty endpoints: catalog, balance and history.
 */
class RewardController extends Controller
{
    /**
     * GET /api/rewards - catalog annotated with affordability and, for food
     * rewards, the live menu item they map to.
     */
    public function index(Request $request): JsonResponse
    {
        $balance = PointLedger::balance($request->user()->id);

        $slugs = collect(PointLedger::definitions())
            ->where('type', 'free_item')
            ->pluck('menu_item_slug')
            ->filter()
            ->values()
            ->all();

        $items = MenuItem::query()
            ->whereIn('slug', $slugs)
            ->get(['id', 'slug', 'name', 'base_price', 'is_available'])
            ->keyBy('slug');

        $rewards = collect(PointLedger::definitions())->map(function (array $definition, string $key) use ($balance, $items) {
            $reward = [
                'key' => $key,
                'type' => $definition['type'],
                'label' => $definition['label'],
                'points_cost' => (int) ($definition['points_cost'] ?? 0),
                'can_afford' => $balance >= (int) ($definition['points_cost'] ?? PHP_INT_MAX),
            ];

            if (($definition['type'] ?? null) === 'free_item') {
                $item = $items->get((string) ($definition['menu_item_slug'] ?? ''));
                $reward['menu_item'] = $item ? [
                    'id' => $item->id,
                    'name' => $item->name,
                    'base_price' => $item->base_price,
                    'is_available' => $item->is_available,
                ] : null;
                $reward['is_available'] = $item !== null && (bool) $item->is_available;
            } else {
                $reward['discount_amount'] = $definition['discount_amount'] ?? 0;
                $reward['min_order_amount'] = $definition['min_order_amount'] ?? 0;
                $reward['is_available'] = true;
            }

            return $reward;
        })->values()->all();

        return response()->json(['data' => ['balance' => $balance, 'rewards' => $rewards]]);
    }

    /**
     * GET /api/points - balance plus the most recent ledger entries.
     */
    public function points(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $history = $request->user()->pointTransactions()
            ->with('order:id,order_number')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => [
                'balance' => PointLedger::balance($userId),
                'history' => $history,
            ],
        ]);
    }
}
