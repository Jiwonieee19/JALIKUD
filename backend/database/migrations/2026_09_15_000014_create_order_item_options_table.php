<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_item_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
            $table->string('option_name', 100); // snapshot, e.g. "Large", "Extra Cheese"
            $table->decimal('price_delta', 10, 2);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_item_options');
    }
};
