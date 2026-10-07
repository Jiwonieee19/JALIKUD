<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Deleting a category that still has menu items must be refused with 422,
 * never explode with a 500.
 *
 * The menu_items.category_id foreign key is RESTRICT, so
 * CategoryController@destroy without a guard surfaces Postgres SQLSTATE 23503
 * as a generic "Server Error". Soft-deleted items count too: their
 * category_id row still references the category, and deleting the parent
 * would strand them on restore.
 */
class CategoryDeleteGuardTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function category(): Category
    {
        return Category::create(['name' => 'Mains', 'slug' => 'mains-'.Str::random(6)]);
    }

    private function itemFor(Category $category): MenuItem
    {
        return MenuItem::create([
            'category_id' => $category->id,
            'name' => 'Chicken Adobo',
            'slug' => 'adobo-'.Str::random(6),
            'base_price' => 150,
            'is_available' => true,
        ]);
    }

    public function test_deleting_an_empty_category_succeeds(): void
    {
        $this->admin();
        $category = $this->category();

        $this->deleteJson("/api/admin/categories/{$category->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Category deleted.');

        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    }

    public function test_deleting_a_category_with_menu_items_returns_422(): void
    {
        $this->admin();
        $category = $this->category();
        $this->itemFor($category);

        $this->deleteJson("/api/admin/categories/{$category->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('category');

        // The guard must fire *instead of* the delete, not after it.
        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }

    public function test_soft_deleted_menu_items_still_block_the_delete(): void
    {
        $this->admin();
        $category = $this->category();
        $item = $this->itemFor($category);
        $item->delete();

        $this->assertSoftDeleted('menu_items', ['id' => $item->id]);

        $this->deleteJson("/api/admin/categories/{$category->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors('category');

        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }

    public function test_non_admin_is_forbidden_not_leaked(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_CUSTOMER]));
        $category = $this->category();

        $this->deleteJson("/api/admin/categories/{$category->id}")->assertForbidden();
    }
}
