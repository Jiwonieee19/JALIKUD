<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Requests validate `name` up to 255 chars but the column was 150.
        Schema::table('users', function ($table) {
            $table->string('name', 255)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function ($table) {
            $table->string('name', 150)->change();
        });
    }
};
