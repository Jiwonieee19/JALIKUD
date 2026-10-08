<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\PaginationRequest;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Customer reviews of completed orders and menu items, plus admin moderation.
 */
class ReviewController extends Controller
{
    /**
     * POST /api/orders/{order}/review - customer reviews their own completed order.
     */
    public function store(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();

        if ($order->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($order->status !== Order::STATUS_COMPLETED) {
            return response()->json(['message' => 'Only completed orders can be reviewed.'], 422);
        }

        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:1000'],
            'menu_item_id' => ['nullable', 'integer', 'exists:menu_items,id'],
        ]);

        // A menu-item review must reference an item that was actually ordered.
        if (($data['menu_item_id'] ?? null) !== null) {
            $ordered = $order->orderItems()
                ->where('menu_item_id', $data['menu_item_id'])
                ->exists();

            if (! $ordered) {
                return response()->json(['message' => 'The selected item is not part of this order.'], 422);
            }
        }

        // The DB unique index covers (order_id, user_id, menu_item_id), but SQL
        // treats NULL menu_item_id as distinct, so the order-level review is
        // guarded here to keep "one review per order" honest.
        $existing = Review::query()
            ->where('order_id', $order->id)
            ->where('user_id', $user->id)
            ->where('menu_item_id', $data['menu_item_id'] ?? null)
            ->exists();

        if ($existing) {
            return response()->json(['message' => 'You have already reviewed this.'], 422);
        }

        $review = Review::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'menu_item_id' => $data['menu_item_id'] ?? null,
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
        ]);

        return response()->json(['data' => $review->fresh()], 201);
    }

    /**
     * GET /api/menu/{menuItem}/reviews - public rating summary + recent reviews.
     */
    public function menuItemReviews(MenuItem $menuItem): JsonResponse
    {
        $reviews = $menuItem->reviews()
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => [
                'average' => round((float) $reviews->avg('rating'), 2),
                'count' => $reviews->count(),
                'reviews' => $reviews,
            ],
        ]);
    }

    /**
     * GET /api/admin/reviews - moderation list.
     */
    public function adminIndex(PaginationRequest $request): JsonResponse
    {
        $reviews = Review::query()
            ->with(['user:id,name,email', 'menuItem:id,name'])
            ->orderByDesc('created_at')
            ->paginate($request->perPage(15));

        return $this->paginated($reviews);
    }

    /**
     * DELETE /api/admin/reviews/{review} - moderation removal.
     */
    public function destroy(Review $review): JsonResponse
    {
        $review->delete();

        return response()->json(['message' => 'Review removed.']);
    }
}
