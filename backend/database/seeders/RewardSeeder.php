<?php

namespace Database\Seeders;

use App\Models\MenuItem;
use App\Models\Reward;
use Illuminate\Database\Seeder;

/**
 * Seeds the loyalty reward catalogue from config/rewards.php. The config file is
 * the seed source now that rewards live in a table; PointLedger::definitions()
 * reads the table at runtime.
 *
 * Idempotent: matched on the unique `key` and updated in place.
 */
class RewardSeeder extends Seeder
{
    public function run(): void
    {
        foreach (config('rewards.definitions', []) as $key => $definition) {
            $type = $definition['type'] ?? 'voucher';

            $menuItemId = $type === 'free_item'
                ? MenuItem::where('slug', $definition['menu_item_slug'] ?? '')->value('id')
                : null;

            Reward::updateOrCreate(
                ['key' => $key],
                [
                    'label' => $definition['label'] ?? $key,
                    'type' => $type,
                    'points_cost' => (int) ($definition['points_cost'] ?? 0),
                    'menu_item_id' => $menuItemId,
                    'discount_amount' => $type === 'voucher' ? ($definition['discount_amount'] ?? null) : null,
                    'min_order_amount' => $type === 'voucher' ? ($definition['min_order_amount'] ?? null) : null,
                    'is_active' => true,
                ],
            );
        }
    }
}
