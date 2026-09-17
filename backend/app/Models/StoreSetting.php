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
}