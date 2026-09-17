<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 30); // stripe|paypal|gcash|cod
            $table->string('provider_transaction_id', 150)->nullable();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 10)->default('PHP');
            $table->string('status', 15)->default('pending'); // pending|succeeded|failed|refunded
            $table->timestampTz('paid_at')->nullable();
            $table->jsonb('raw_response')->nullable(); // full gateway payload for debugging
            $table->timestamps();

            $table->index('order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
