<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('point_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->cascadeOnDelete();
            // Signed delta: earned/refunded add, spent subtracts.
            $table->integer('points_delta');
            $table->integer('balance_after');
            // earned|spent|refunded
            $table->string('reason', 15);
            $table->string('description', 255)->nullable();
            $table->timestamps();

            $table->index('user_id');
            // One ledger row per (order, reason): earning and spending each
            // happen at most once per order, which makes retries idempotent.
            // NULL order_ids stay distinct in both Postgres and SQLite.
            $table->unique(['order_id', 'reason']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('point_transactions');
    }
};
