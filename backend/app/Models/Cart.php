<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cart extends Model
{
    protected $fillable = [
        'user_id',
        'session_id',
        'order_type',
        'address_id',
        'coupon_id',
        'reward_key',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class);
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function cartItems(): HasMany
    {
        // Oldest-first everywhere (serialize, pricing, merge/collapse): without
        // an explicit order the line sequence can shift after updates/deletes
        // and the app's rows visibly swap on every +/− tap.
        return $this->hasMany(CartItem::class)->orderBy('id');
    }
}