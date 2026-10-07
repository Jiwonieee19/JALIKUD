<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('reward_key', 50)->nullable()->after('coupon_id');
            $table->decimal('reward_discount_amount', 10, 2)->default(0)->after('reward_key');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['reward_key', 'reward_discount_amount']);
        });
    }
};
