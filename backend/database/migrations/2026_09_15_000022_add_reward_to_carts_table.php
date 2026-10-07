<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            // Key into config('rewards.definitions'). Points are reserved,
            // not deducted, until checkout succeeds.
            $table->string('reward_key', 50)->nullable()->after('coupon_id');
        });
    }

    public function down(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            $table->dropColumn('reward_key');
        });
    }
};
