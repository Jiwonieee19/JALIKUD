<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Coupon extends Model
{
    protected $fillable = [
        'code',
        'type',
        'value',
        'min_order_amount',
        'max_discount_amount',
        'usage_limit',
        'usage_limit_per_user',
        'starts_at',
        'expires_at',
        'is_active',
    ];

    /**
     * Friendly normalization: `save10` is stored as `SAVE10` so the
     * database stays UPPERCASE-only regardless of which client created it.
     */
    protected function code(): Attribute
    {
        return Attribute::make(
            set: fn ($value) => $value === null ? null : strtoupper(trim((string) $value)),
        );
    }

    protected function casts(): array
    {
        return [
            'type' => 'string',
            'value' => 'decimal:2',
            'min_order_amount' => 'decimal:2',
            'max_discount_amount' => 'decimal:2',
            'usage_limit' => 'integer',
            'usage_limit_per_user' => 'integer',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function carts(): HasMany
    {
        return $this->hasMany(Cart::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }

    /**
     * Reload the row with a FOR UPDATE lock (Postgres) so concurrent orders
     * cannot both pass the redemption-limit check on the last available unit.
     */
    public function lockForRedemption(): self
    {
        return static::whereKey($this->getKey())->lockForUpdate()->firstOrFail();
    }

    public function isWithinValidityWindow(?Carbon $now = null): bool
    {
        $now = $now ?? now();

        if ($this->starts_at !== null && $now->lt($this->starts_at)) {
            return false;
        }

        if ($this->expires_at !== null && $now->gt($this->expires_at)) {
            return false;
        }

        return $this->is_active;
    }

    public function hasReachedGlobalLimit(): bool
    {
        return $this->usage_limit !== null
            && $this->redemptions()->count() >= (int) $this->usage_limit;
    }

    public function hasReachedUserLimit(int $userId): bool
    {
        return $this->usage_limit_per_user !== null
            && $this->redemptions()->where('user_id', $userId)->count() >= (int) $this->usage_limit_per_user;
    }

    /**
     * Why this coupon cannot currently be redeemed, or null when it can.
     *
     * Pass the running subtotal and the redeeming user id to include the
     * minimum-order and usage-limit checks.
     */
    public function rejectionReason(?float $subtotal = null, ?int $userId = null): ?string
    {
        if (! $this->is_active) {
            return 'Coupon code not found or inactive.';
        }

        if (! $this->isWithinValidityWindow()) {
            return 'Coupon code is not currently valid.';
        }

        if ($subtotal !== null && $subtotal < (float) $this->min_order_amount) {
            return 'Order subtotal does not meet the coupon minimum.';
        }

        if ($this->hasReachedGlobalLimit()) {
            return 'Coupon usage limit has been reached.';
        }

        if ($userId !== null && $this->hasReachedUserLimit($userId)) {
            return 'You have already used this coupon.';
        }

        return null;
    }

    /**
     * Discount in currency units for the given subtotal (0 when below minimum).
     */
    public function discountFor(float $subtotal): float
    {
        if ($subtotal < (float) $this->min_order_amount) {
            return 0.0;
        }

        $discount = $this->type === 'fixed'
            ? (float) $this->value
            : round($subtotal * (float) $this->value / 100, 2);

        if ($this->max_discount_amount !== null) {
            $discount = min($discount, (float) $this->max_discount_amount);
        }

        return round(min($discount, $subtotal), 2);
    }
}