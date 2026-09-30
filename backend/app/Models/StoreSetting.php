<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StoreSetting extends Model
{
    // The store_settings table has no created_at column, only updated_at.
    public const CREATED_AT = null;
    public const UPDATED_AT = 'updated_at';

    protected $fillable = [
        'store_name',
        'is_open',
        'accepts_delivery',
        'accepts_pickup',
        'min_order_amount',
        'delivery_fee',
        'tax_rate_percent',
        'opening_time',
        'closing_time',
    ];

    protected function casts(): array
    {
        return [
            'is_open' => 'boolean',
            'accepts_delivery' => 'boolean',
            'accepts_pickup' => 'boolean',
            'min_order_amount' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'tax_rate_percent' => 'decimal:2',
            'opening_time' => 'datetime',
            'closing_time' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * Whether orders can be placed right now: the open flag plus the
     * opening/closing window (an overnight window is supported when the
     * closing time is earlier than the opening time). Missing settings
     * mean "open" so a freshly seeded store is usable immediately.
     */
    public static function isOpenNow(): bool
    {
        $settings = static::query()->first();

        return $settings === null || $settings->openNow();
    }

    public function openNow(): bool
    {
        if (! $this->is_open) {
            return false;
        }

        if ($this->opening_time === null || $this->closing_time === null) {
            return true;
        }

        $now = now()->format('H:i:s');
        $opens = $this->opening_time->format('H:i:s');
        $closes = $this->closing_time->format('H:i:s');

        return $opens <= $closes
            ? ($now >= $opens && $now <= $closes)
            : ($now >= $opens || $now <= $closes);
    }
}