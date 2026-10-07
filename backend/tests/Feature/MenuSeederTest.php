<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\MenuItem;
use Database\Seeders\MenuSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MenuSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_menu_seeder_purges_postman_rows_and_seeds_the_real_catalog(): void
    {
        // Rows shaped exactly like the Postman collection's pre-request output.
        $junkCategory = Category::create(['name' => 'Postman Cat (renamed)', 'slug' => 't-junkcat']);
        $junkItem = MenuItem::create([
            'category_id' => $junkCategory->id,
            'name' => 'Postman Meal t-junkmeal',
            'slug' => 't-junkmeal',
            'description' => 'A delicious POSTMAN-tested meal.',
            'sku' => 'SKU-t-junkmeal',
            'base_price' => 149,
            'is_available' => true,
        ]);

        $this->seed(MenuSeeder::class);

        // Junk rows are gone: items hard-gone (force delete), categories hard-gone.
        $this->assertDatabaseMissing('menu_items', ['slug' => 't-junkmeal']);
        $this->assertDatabaseMissing('categories', ['slug' => 't-junkcat']);
        $this->assertNull(MenuItem::withTrashed()->find($junkItem->id));

        // The real catalog exists, linked and available.
        $this->assertDatabaseHas('categories', ['slug' => 'chickenjoy', 'is_active' => true]);
        $this->assertDatabaseHas('categories', ['slug' => 'burgers', 'is_active' => true]);

        $chickenjoy = Category::where('slug', 'chickenjoy')->firstOrFail();
        $this->assertDatabaseHas('menu_items', [
            'category_id' => $chickenjoy->id,
            'slug' => 'chickenjoy-2pc',
            'base_price' => 199,
            'is_available' => true,
            'is_featured' => true,
        ]);
        $this->assertDatabaseHas('menu_items', ['slug' => 'jolly-spaghetti', 'base_price' => 99]);

        $this->assertSame(4, Category::count());
        $this->assertSame(10, MenuItem::count());
    }

    public function test_menu_seeder_is_idempotent_and_replaces_reintroduced_postman_rows(): void
    {
        $this->seed(MenuSeeder::class);
        $this->seed(MenuSeeder::class);

        $this->assertSame(4, Category::count());
        $this->assertSame(10, MenuItem::count());

        // A later Postman run drops new junk in; the next seed run clears it again.
        $reintroduced = Category::create(['name' => 'Postman Cat (renamed)', 'slug' => 't-again']);
        MenuItem::create([
            'category_id' => $reintroduced->id,
            'name' => 'Postman Meal t-againmeal',
            'slug' => 't-againmeal',
            'base_price' => 149,
            'is_available' => true,
        ]);

        $this->seed(MenuSeeder::class);

        $this->assertSame(4, Category::count());
        $this->assertSame(10, MenuItem::count());
        $this->assertDatabaseMissing('categories', ['slug' => 't-again']);
    }

    public function test_menu_seeder_clears_junk_cart_lines_blocking_force_delete(): void
    {
        $junkCategory = Category::create(['name' => 'Postman Cat (renamed)', 'slug' => 't-cartjunk']);
        $junkItem = MenuItem::create([
            'category_id' => $junkCategory->id,
            'name' => 'Postman Meal t-cartjunk',
            'slug' => 't-cartjunk',
            'base_price' => 149,
            'is_available' => true,
        ]);
        $user = \App\Models\User::factory()->create();
        $cart = \App\Models\Cart::create(['user_id' => $user->id, 'order_type' => 'pickup']);
        \App\Models\CartItem::create([
            'cart_id' => $cart->id,
            'menu_item_id' => $junkItem->id,
            'quantity' => 1,
            'unit_price' => 149,
        ]);

        $this->seed(MenuSeeder::class);

        $this->assertDatabaseMissing('menu_items', ['slug' => 't-cartjunk']);
        $this->assertDatabaseMissing('categories', ['slug' => 't-cartjunk']);
        $this->assertSame(4, Category::count());
        $this->assertSame(10, MenuItem::count());
    }

    public function test_public_menu_endpoint_returns_the_seeded_catalog(): void
    {
        $this->seed(MenuSeeder::class);

        $this->getJson('/api/menu?available=true&per_page=100')
            ->assertOk()
            ->assertJsonCount(10, 'data.data')
            ->assertJsonFragment(['slug' => 'chickenjoy-2pc'])
            ->assertJsonFragment(['slug' => 'jolly-spaghetti']);
    }
}
