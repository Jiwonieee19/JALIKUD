<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PointTransaction;
use Illuminate\Support\Facades\DB;

/**
 * Single source of truth for loyalty points. The balance is the sum of the
 * ledger; every mutation runs inside the caller's transaction and locks the
 * user's rows first so concurrent checkouts cannot double-spend.
 */
class PointLedger
{
    public static function pesosPerPoint(): int
    {
        return (int) (config('rewards.pesos_per_point') ?? 10);
    }

    public static function definitions(): array
    {
        return config('rewards.definitions') ?? [];
    }

    public static function definition(string $key): ?array
    {
        $definition = static::definitions()[$key] ?? null;

        return is_array($definition) ? $definition : null;
    }

    /**
     * Current balance, locking the user's ledger rows so a surrounding
     * transaction can check-and-deduct atomically.
     */
    public static function lockedBalance(int $userId): int
    {
        // Lock the user's ledger rows first, then aggregate in PHP. A
        // `FOR UPDATE` clause is not allowed alongside an aggregate (SUM())
        // on PostgreSQL, so `->sum()` after `->lockForUpdate()` would throw
        // and silently prevent points from being awarded in production.
        return (int) PointTransaction::query()
            ->where('user_id', $userId)
            ->lockForUpdate()
            ->pluck('points_delta')
            ->sum();
    }

    public static function balance(int $userId): int
    {
        return (int) PointTransaction::query()
            ->where('user_id', $userId)
            ->sum('points_delta');
    }

    private static function record(int $userId, ?int $orderId, int $delta, int $balanceAfter, string $reason, ?string $description): PointTransaction
    {
        return PointTransaction::create([
            'user_id' => $userId,
            'order_id' => $orderId,
            'points_delta' => $delta,
            'balance_after' => $balanceAfter,
            'reason' => $reason,
            'description' => $description,
        ]);
    }

    /**
     * Award floor(total / pesosPerPoint) once an order is both completed
     * and paid. Safe to call from either transition first; the second call
     * is a no-op thanks to the (order_id, reason) unique index.
     */
    public static function awardForOrder(Order $order): ?PointTransaction
    {
        if ($order->status !== Order::STATUS_COMPLETED || $order->payment_status !== Order::PAYMENT_PAID) {
            return null;
        }

        $points = intdiv((int) round((float) $order->total_amount), static::pesosPerPoint());

        if ($points <= 0) {
            return null;
        }

        return DB::transaction(function () use ($order, $points) {
            $exists = PointTransaction::query()
                ->where('order_id', $order->id)
                ->where('reason', PointTransaction::REASON_EARNED)
                ->lockForUpdate()
                ->exists();

            if ($exists) {
                return null;
            }

            $balance = static::lockedBalance($order->user_id);

            return static::record(
                $order->user_id,
                $order->id,
                $points,
                $balance + $points,
                PointTransaction::REASON_EARNED,
                "Earned from {$order->order_number}",
            );
        });
    }

    /**
     * Deduct points for a reward redemption. Call inside the checkout
     * transaction after all other validations pass.
     */
    public static function spendForOrder(int $userId, Order $order, int $points, string $description): PointTransaction
    {
        $balance = static::lockedBalance($userId);

        if ($balance < $points) {
            abort(response()->json(['message' => 'Not enough points for this reward.'], 422));
        }

        return static::record(
            $userId,
            $order->id,
            -$points,
            $balance - $points,
            PointTransaction::REASON_SPENT,
            $description,
        );
    }

    /**
     * Refund spent points when an order that consumed a reward is cancelled.
     * No-op when nothing was spent or a refund already exists.
     */
    public static function refundForOrder(Order $order): ?PointTransaction
    {
        return DB::transaction(function () use ($order) {
            $spent = PointTransaction::query()
                ->where('order_id', $order->id)
                ->where('reason', PointTransaction::REASON_SPENT)
                ->lockForUpdate()
                ->first();

            if ($spent === null) {
                return null;
            }

            $refunded = PointTransaction::query()
                ->where('order_id', $order->id)
                ->where('reason', PointTransaction::REASON_REFUNDED)
                ->lockForUpdate()
                ->exists();

            if ($refunded) {
                return null;
            }

            $balance = static::lockedBalance($order->user_id);
            $refund = -$spent->points_delta;

            return static::record(
                $order->user_id,
                $order->id,
                $refund,
                $balance + $refund,
                PointTransaction::REASON_REFUNDED,
                "Refund for cancelled {$order->order_number}",
            );
        });
    }
}
