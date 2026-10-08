<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Reward;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminRewardTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN]);
    }

    private function item(string $slug = 'chickenjoy-1pc'): MenuItem
    {
        $category = Category::create(['name' => 'Mains', 'slug' => 'mains-'.Str::random(6)]);

        return MenuItem::create([
            'category_id' => $category->id,
            'name' => 'Item '.$slug,
            'slug' => $slug,
            'base_price' => 109,
            'is_available' => true,
        ]);
    }

    public function test_admin_can_create_update_and_delete_a_reward(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/admin/rewards', [
            'key' => 'voucher-50',
            'label' => '₱50 Off',
            'type' => 'voucher',
            'points_cost' => 400,
            'discount_amount' => 50,
            'min_order_amount' => 200,
        ])->assertStatus(201)->assertJsonPath('data.key', 'voucher-50');

        $reward = Reward::firstWhere('key', 'voucher-50');

        $this->patchJson("/api/admin/rewards/{$reward->id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->deleteJson("/api/admin/rewards/{$reward->id}")->assertOk();
        $this->assertDatabaseMissing('rewards', ['key' => 'voucher-50']);
    }

    public function test_free_item_reward_requires_a_menu_item(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/admin/rewards', [
            'key' => 'free-fries',
            'label' => 'Free Fries',
            'type' => 'free_item',
            'points_cost' => 200,
        ])->assertStatus(422)->assertJsonValidationErrors(['menu_item_id']);
    }

    public function test_inactive_rewards_are_hidden_from_the_customer_catalog(): void
    {
        $this->admin();
        $item = $this->item('chickenjoy-1pc');

        Reward::create([
            'key' => 'chickenjoy-1pc',
            'label' => 'Free Chickenjoy 1pc',
            'type' => 'free_item',
            'points_cost' => 500,
            'menu_item_id' => $item->id,
            'is_active' => false,
        ]);

        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        Sanctum::actingAs($customer);

        $this->getJson('/api/rewards')->assertOk()->assertJsonCount(0, 'data.rewards');
    }

    public function test_non_admin_cannot_manage_rewards(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_STAFF]));
        $this->getJson('/api/admin/rewards')->assertStatus(403);
    }
}
