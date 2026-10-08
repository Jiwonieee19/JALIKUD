<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reward extends Model
{
    protected $fillable = [
        'key',
        'label',
        'type',
        'points_cost',
        'menu_item_id',
        'discount_amount',
        'min_order_amount',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'points_cost' => 'integer',
            'discount_amount' => 'decimal:2',
            'min_order_amount' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }
}
