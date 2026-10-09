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
        $this->call([
            UserSeeder::class,
            MenuSeeder::class,
            RewardSeeder::class,
            DemoOrderSeeder::class,
        ]);

        // Seed a default store setting if none exists (matches production pricing).
        if (\App\Models\StoreSetting::count() === 0) {
            \App\Models\StoreSetting::create([
                'store_name' => 'JALIKUD',
                'is_open' => true,
                'accepts_delivery' => true,
                'accepts_pickup' => true,
                'min_order_amount' => 0,
                'delivery_fee' => 49,
                'tax_rate_percent' => 12,
                // 24/7: leaving both hours null makes StoreSetting::openNow()
                // return true regardless of the clock, so only the is_open toggle
                // governs availability. A window like 00:00-23:59 would still close
                // the store for one minute a day.
                'opening_time' => null,
                'closing_time' => null,
            ]);
        }
    }
}
