<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VariantOption extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'variant_group_id',
        'name',
        'price_delta',
        'is_default',
        'is_available',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price_delta' => 'decimal:2',
            'is_default' => 'boolean',
            'is_available' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function variantGroup(): BelongsTo
    {
        return $this->belongsTo(VariantGroup::class);
    }

    public function cartItemOptions(): HasMany
    {
        return $this->hasMany(CartItemOption::class);
    }

    public function orderItemOptions(): HasMany
    {
        return $this->hasMany(OrderItemOption::class);
    }
}