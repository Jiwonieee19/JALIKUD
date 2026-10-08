<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\VariantGroup;
use App\Models\VariantOption;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Regression coverage for the public menu payload.
 *
 * MenuItemController eager-loads `variantGroups.options`. VariantGroup only
 * defined variantOptions(), so that eager-load threw RelationNotFoundException
 * and every /api/menu request 500'd as soon as a menu item actually had a
 * variant group — invisible while the menu table was empty. These tests pin
 * the documented `options` JSON key so a future rename fails loudly.
 */
class MenuItemVariantLoadingTest extends TestCase
{
    use RefreshDatabase;

    private function menuItemWithSizeOption(float $delta = 25.0): MenuItem
    {
        $category = Category::create(['name' => 'Mains', 'slug' => 'mains-'.Str::random(6)]);

        $item = MenuItem::create([
            'category_id' => $category->id,
            'name' => 'Chicken Adobo',
            'slug' => 'adobo-'.Str::random(6),
            'base_price' => 100.0,
            'is_available' => true,
        ]);

        $group = VariantGroup::create([
            'menu_item_id' => $item->id,
            'name' => 'Size',
            'selection_type' => 'single',
            'is_required' => true,
            'min_select' => 1,
        ]);

        VariantOption::create([
            'variant_group_id' => $group->id,
            'name' => 'Large',
            'price_delta' => $delta,
        ]);

        return $item;
    }

    public function test_menu_index_succeeds_and_nests_options_under_each_variant_group(): void
    {
        $this->menuItemWithSizeOption(25.0);

        $response = $this->getJson('/api/menu');

        // Relations serialize snake_cased, so the eager-loaded
        // `variantGroups.options` is emitted as variant_groups[].options[].
        $response->assertOk()
            ->assertJsonPath('data.0.variant_groups.0.name', 'Size')
            ->assertJsonPath('data.0.variant_groups.0.options.0.name', 'Large')
            ->assertJsonPath('data.0.variant_groups.0.options.0.price_delta', '25.00');
    }

    public function test_menu_show_succeeds_and_nests_options_under_each_variant_group(): void
    {
        $item = $this->menuItemWithSizeOption(30.0);

        $this->getJson('/api/menu/'.$item->id)
            ->assertOk()
            ->assertJsonPath('data.variant_groups.0.options.0.name', 'Large')
            ->assertJsonPath('data.variant_groups.0.options.0.price_delta', '30.00');
    }

    public function test_options_alias_resolves_to_the_same_relation_as_variant_options(): void
    {
        $item = $this->menuItemWithSizeOption();

        $group = VariantGroup::where('menu_item_id', $item->id)->firstOrFail();

        $this->assertSame(
            $group->variantOptions()->count(),
            $group->options()->count()
        );
    }
}
