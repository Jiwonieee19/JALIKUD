<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cart_item_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cart_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('variant_option_id')->constrained()->restrictOnDelete();
            $table->decimal('price_delta', 10, 2);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cart_item_options');
    }
};
