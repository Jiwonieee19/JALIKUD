<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SlugDerivationTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN]);
    }

    public function test_menu_item_derives_slug_from_name(): void
    {
        Sanctum::actingAs($this->admin());
        $category = Category::create(['name' => 'Mains', 'slug' => 'mains-'.Str::random(6)]);

        $this->postJson('/api/admin/menu-items', [
            'category_id' => $category->id,
            'name' => 'Spicy Chicken Joy',
            'base_price' => 150,
        ])->assertStatus(201)->assertJsonPath('data.slug', 'spicy-chicken-joy');
    }

    public function test_category_derives_slug_from_name(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/admin/categories', ['name' => 'Family Meals'])
            ->assertStatus(201)
            ->assertJsonPath('data.slug', 'family-meals');
    }
}
