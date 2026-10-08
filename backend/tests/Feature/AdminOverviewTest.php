<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminOverviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_overview_returns_the_dashboard_shape(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));

        $this->getJson('/api/admin/overview')->assertOk()->assertJsonStructure([
            'data' => [
                'revenue_today',
                'orders_today',
                'active_orders',
                'completed_today',
                'cancelled_today',
                'pending_orders',
                'sold_out_items',
                'menu_items_total',
                'riders_available',
                'riders_on_delivery',
                'riders_offline',
                'store_open',
                'generated_at',
            ],
        ]);
    }

    public function test_revenue_series_returns_seven_days(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));

        $this->getJson('/api/admin/overview/revenue')->assertOk()->assertJsonCount(7, 'data');
    }

    public function test_overview_requires_admin(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_STAFF]));
        $this->getJson('/api/admin/overview')->assertStatus(403);
    }
}
