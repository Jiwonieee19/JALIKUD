<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('variant_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variant_group_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100); // e.g. "Large", "Extra Cheese"
            $table->decimal('price_delta', 10, 2)->default(0);
            $table->boolean('is_default')->default(false);
            $table->boolean('is_available')->default(true);
            $table->integer('sort_order')->default(0);

            $table->index('variant_group_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('variant_options');
    }
};
