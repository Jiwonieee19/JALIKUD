<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderStatusHistory extends Model
{
    public $timestamps = false;

    // Explicit: the migration creates "order_status_history" (not pluralised).
    protected $table = 'order_status_history';

    protected $fillable = [
        'order_id',
        'status',
        'changed_by',
        'note',
    ];

    /**
     * The migration only creates a `created_at` column (no `updated_at`), which
     * is why $timestamps stays disabled. Cast it explicitly so history entries
     * serialise `created_at` as an ISO-8601 datetime for the staff UI.
     */
    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}