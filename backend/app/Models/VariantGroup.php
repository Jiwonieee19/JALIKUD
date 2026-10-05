<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VariantGroup extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'menu_item_id',
        'name',
        'selection_type',
        'is_required',
        'min_select',
        'max_select',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'min_select' => 'integer',
            'max_select' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }

    public function variantOptions(): HasMany
    {
        return $this->hasMany(VariantOption::class);
    }

    /**
     * Alias for variantOptions().
     *
     * The public menu payload exposes each group's choices under the key
     * `options`, and MenuItemController eager-loads `variantGroups.options`
     * to match. Without this alias that eager-load throws
     * RelationNotFoundException (HTTP 500 on /api/menu) as soon as a menu
     * item actually has a variant group.
     *
     * Keep this name in sync with the documented API shape in
     * backend/README.md and frontend/docs/API_WIRING.md.
     */
    public function options(): HasMany
    {
        return $this->variantOptions();
    }
}