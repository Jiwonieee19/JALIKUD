<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\User;
use App\Models\VariantGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VariantManagementTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN]);
    }

    private function item(): MenuItem
    {
        $category = Category::create(['name' => 'Mains', 'slug' => 'mains-'.Str::random(6)]);

        return MenuItem::create([
            'category_id' => $category->id,
            'name' => 'Adobo',
            'slug' => 'adobo-'.Str::random(6),
            'base_price' => 100,
            'is_available' => true,
        ]);
    }

    public function test_admin_can_create_and_list_variant_groups(): void
    {
        $item = $this->item();
        Sanctum::actingAs($this->admin());

        $this->postJson("/api/admin/menu-items/{$item->id}/variant-groups", [
            'name' => 'Size',
            'selection_type' => 'single',
            'is_required' => true,
            'min_select' => 1,
        ])->assertStatus(201)->assertJsonPath('data.name', 'Size');

        $this->getJson("/api/admin/menu-items/{$item->id}/variant-groups")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_admin_can_add_option_to_a_group(): void
    {
        $item = $this->item();
        $group = VariantGroup::create(['menu_item_id' => $item->id, 'name' => 'Size']);
        Sanctum::actingAs($this->admin());

        $this->postJson("/api/admin/variant-groups/{$group->id}/options", [
            'name' => 'Large',
            'price_delta' => 50,
        ])->assertStatus(201)->assertJsonPath('data.name', 'Large');
    }

    public function test_admin_can_update_and_delete_variant_group(): void
    {
        $item = $this->item();
        $group = VariantGroup::create(['menu_item_id' => $item->id, 'name' => 'Size']);
        Sanctum::actingAs($this->admin());

        $this->putJson("/api/admin/variant-groups/{$group->id}", ['name' => 'Portion'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Portion');

        $this->deleteJson("/api/admin/variant-groups/{$group->id}")->assertOk();
        $this->assertDatabaseMissing('variant_groups', ['id' => $group->id]);
    }

    public function test_non_admin_cannot_manage_variants(): void
    {
        $item = $this->item();
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_STAFF]));

        $this->postJson("/api/admin/menu-items/{$item->id}/variant-groups", ['name' => 'Size'])
            ->assertStatus(403);
    }
}
