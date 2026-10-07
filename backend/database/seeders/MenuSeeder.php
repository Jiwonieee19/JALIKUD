<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Database\Seeder;

/**
 * Seeds the public catalog with the real JALIKUD menu and purges the rows the
 * Postman collection's pre-request scripts generate ("Postman Cat …" /
 * "Postman Meal t-*").
 *
 * Idempotent: catalog rows are matched on their unique slug and updated in
 * place, so it is safe to run repeatedly, including against a live database:
 *
 *   php artisan db:seed --class=MenuSeeder
 */
class MenuSeeder extends Seeder
{
    /**
     * Categories in display order, each with its menu items.
     *
     * @return array<int, array{name: string, slug: string, sort_order: int, items: array<int, array<string, mixed>>}>
     */
    private function catalog(): array
    {
        return [
            [
                'name' => 'Chickenjoy',
                'slug' => 'chickenjoy',
                'sort_order' => 1,
                'items' => [
                    ['name' => 'Chickenjoy 1pc', 'slug' => 'chickenjoy-1pc', 'base_price' => 109, 'description' => 'One piece of crispy Chickenjoy with a steamed rice.', 'preparation_time_minutes' => 12, 'calories' => 380],
                    ['name' => 'Chickenjoy 2pc', 'slug' => 'chickenjoy-2pc', 'base_price' => 199, 'description' => 'Two pieces of crispy Chickenjoy with a steamed rice.', 'preparation_time_minutes' => 12, 'calories' => 640, 'is_featured' => true],
                    ['name' => 'Chickenjoy 6pc', 'slug' => 'chickenjoy-6pc', 'base_price' => 549, 'description' => 'Six pieces of crispy Chickenjoy, good for sharing.', 'preparation_time_minutes' => 15, 'calories' => 1920],
                    ['name' => 'Chickenjoy 8pc Family', 'slug' => 'chickenjoy-8pc-family', 'base_price' => 729, 'description' => 'Eight pieces of crispy Chickenjoy for the whole family.', 'preparation_time_minutes' => 18, 'calories' => 2560],
                ],
            ],
            [
                'name' => 'Burgers',
                'slug' => 'burgers',
                'sort_order' => 2,
                'items' => [
                    ['name' => 'Yumburger', 'slug' => 'yumburger', 'base_price' => 89, 'description' => 'Classic beef burger with our signature dressing.', 'preparation_time_minutes' => 8, 'calories' => 320],
                    ['name' => 'Champ Burger', 'slug' => 'champ-burger', 'base_price' => 179, 'description' => 'Double beef patty burger with cheese and dressing.', 'preparation_time_minutes' => 10, 'calories' => 560, 'is_featured' => true],
                    ['name' => 'Chicken & Burger Combo', 'slug' => 'chicken-burger-combo', 'base_price' => 249, 'description' => 'Chickenjoy and a burger served together with rice.', 'preparation_time_minutes' => 14, 'calories' => 890],
                ],
            ],
            [
                'name' => 'Rice Meals',
                'slug' => 'rice-meals',
                'sort_order' => 3,
                'items' => [
                    ['name' => 'Burger Steak', 'slug' => 'burger-steak', 'base_price' => 139, 'description' => 'Beef patty over rice with mushroom gravy.', 'preparation_time_minutes' => 10, 'calories' => 520],
                    ['name' => '1pc Burger Steak Solo', 'slug' => 'burger-steak-solo', 'base_price' => 99, 'description' => 'Single burger steak with rice, a lighter serving.', 'preparation_time_minutes' => 8, 'calories' => 390],
                ],
            ],
            [
                'name' => 'Pasta',
                'slug' => 'pasta',
                'sort_order' => 4,
                'items' => [
                    ['name' => 'Jolly Spaghetti', 'slug' => 'jolly-spaghetti', 'base_price' => 99, 'description' => 'Sweet-style spaghetti with hotdog and cheese.', 'preparation_time_minutes' => 8, 'calories' => 430],
                ],
            ],
        ];
    }

    public function run(): void
    {
        $this->purgePostmanRows();

        foreach ($this->catalog() as $category) {
            $items = $category['items'];
            unset($category['items']);

            $row = Category::updateOrCreate(
                ['slug' => $category['slug']],
                $category + ['is_active' => true]
            );

            foreach ($items as $item) {
                MenuItem::updateOrCreate(
                    ['slug' => $item['slug']],
                    $item + [
                        'category_id' => $row->id,
                        'is_available' => true,
                        'is_featured' => $item['is_featured'] ?? false,
                    ],
                );
            }
        }
    }

    /**
     * Remove everything the Postman collection auto-generates. Menu items use
     * SoftDeletes, so their rows must be force-deleted before their hard-deleted
     * category can pass the menu_items.category_id foreign key. Cart rows use
     * restrictOnDelete against menu_items, so carts referencing junk are removed
     * first; rows kept alive by order history fall back to soft-delete +
     * unavailable instead of blocking the whole seed run.
     */
    private function purgePostmanRows(): void
    {
        $junkCategoryIds = Category::query()
            ->where(function ($query) {
                $query->where('name', 'like', 'Postman %')
                    ->orWhere('slug', 'like', 't-%');
            })
            ->pluck('id');

        $junkItems = MenuItem::withTrashed()
            ->where(function ($query) use ($junkCategoryIds) {
                $query->where('name', 'like', 'Postman Meal %')
                    ->orWhere('slug', 'like', 't-%')
                    ->orWhere('sku', 'like', 'SKU-t-%')
                    ->orWhereIn('category_id', $junkCategoryIds);
            })
            ->get();

        if ($junkItems->isNotEmpty()) {
            $junkItemIds = $junkItems->pluck('id')->all();

            // Carts are ephemeral: drop junk lines first (options cascade).
            // Orders are history and must be kept, so items tied to an order
            // fall back to hidden instead of force-deleting below.
            \App\Models\CartItem::whereIn('menu_item_id', $junkItemIds)->delete();

            $junkItems->each(function (MenuItem $item) {
                try {
                    $item->forceDelete();
                } catch (\Illuminate\Database\QueryException) {
                    $item->update(['is_available' => false]);
                    if (! $item->trashed()) {
                        $item->delete();
                    }
                }
            });
        }

        Category::whereIn('id', $junkCategoryIds)->delete();

        // Any junk category that survived (e.g. still referenced by a
        // soft-deleted item kept for order history) must stay hidden from the
        // public ?active=true catalog the mobile app uses.
        Category::query()
            ->where(function ($query) {
                $query->where('name', 'like', 'Postman %')
                    ->orWhere('slug', 'like', 't-%');
            })
            ->update(['is_active' => false]);
    }
}
