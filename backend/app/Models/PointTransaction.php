<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PointTransaction extends Model
{
    public const REASON_EARNED = 'earned';

    public const REASON_SPENT = 'spent';

    public const REASON_REFUNDED = 'refunded';

    protected $fillable = [
        'user_id',
        'order_id',
        'points_delta',
        'balance_after',
        'reason',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'points_delta' => 'integer',
            'balance_after' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
