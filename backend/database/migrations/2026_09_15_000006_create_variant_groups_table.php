<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('variant_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('menu_item_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100); // e.g. "Size", "Add-ons"
            $table->string('selection_type', 10)->default('single'); // single|multiple
            $table->boolean('is_required')->default(false);
            $table->integer('min_select')->default(0);
            $table->integer('max_select')->nullable();
            $table->integer('sort_order')->default(0);

            $table->index('menu_item_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('variant_groups');
    }
};
