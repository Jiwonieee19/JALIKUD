<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rewards', function (Blueprint $table) {
            $table->id();
            // Customer-facing identifier (stored on carts/orders.reward_key).
            $table->string('key', 50)->unique();
            $table->string('label', 120);
            $table->string('type', 15); // free_item|voucher
            $table->unsignedInteger('points_cost');
            $table->foreignId('menu_item_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('discount_amount', 10, 2)->nullable();
            $table->decimal('min_order_amount', 10, 2)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE rewards ADD CONSTRAINT rewards_type_check CHECK (type IN ('free_item','voucher'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('rewards');
    }
};
