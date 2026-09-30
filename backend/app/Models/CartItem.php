<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CartItem extends Model
{
    protected $fillable = [
        'cart_id',
        'menu_item_id',
        'quantity',
        'unit_price',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
        ];
    }

    public function cart(): BelongsTo
    {
        return $this->belongsTo(Cart::class);
    }

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(CartItemOption::class);
    }

    /**
     * Line total including variant option price deltas:
     * (unit price + sum of deltas) x quantity.
     */
    public function lineTotal(): float
    {
        $unit = (float) $this->unit_price + (float) $this->options->sum('price_delta');

        return round($unit * (int) $this->quantity, 2);
    }
}