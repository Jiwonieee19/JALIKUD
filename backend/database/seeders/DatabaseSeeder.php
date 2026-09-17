<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Seed a default store setting if none exists
        if (\App\Models\StoreSetting::count() === 0) {
            \App\Models\StoreSetting::create([
                'store_name' => 'JALIKUD',
                'is_open' => true,
                'accepts_delivery' => true,
                'accepts_pickup' => true,
                'min_order_amount' => 0,
                'delivery_fee' => 0,
                'tax_rate_percent' => 0,
                'opening_time' => '08:00:00',
                'closing_time' => '22:00:00',
            ]);
        }
    }
}
