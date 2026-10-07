<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RiderProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_rider_can_read_and_update_own_profile(): void
    {
        $rider = User::factory()->create(['role' => User::ROLE_RIDER]);
        Sanctum::actingAs($rider);

        $this->getJson('/api/rider/profile')->assertOk()->assertJsonPath('data.user_id', $rider->id);

        $this->putJson('/api/rider/profile', ['vehicle_type' => 'motorcycle', 'plate_number' => 'ABC-1234'])
            ->assertOk()
            ->assertJsonPath('data.plate_number', 'ABC-1234');
    }

    public function test_admin_can_administer_rider_profile(): void
    {
        $rider = User::factory()->create(['role' => User::ROLE_RIDER]);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));

        $this->putJson("/api/admin/riders/{$rider->id}/profile", ['vehicle_type' => 'car', 'is_active' => true])
            ->assertOk()
            ->assertJsonPath('data.vehicle_type', 'car');
    }

    public function test_admin_profile_update_rejects_non_riders(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));

        $this->putJson("/api/admin/riders/{$customer->id}/profile", ['is_active' => true])
            ->assertStatus(422);
    }

    public function test_creating_rider_via_admin_provisions_a_profile(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN]));

        $this->postJson('/api/admin/users', [
            'name' => 'Rider X',
            'email' => 'riderx@example.com',
            'password' => 'Str0ngPassw0rd',
            'role' => 'rider',
        ])->assertStatus(201);

        $user = User::where('email', 'riderx@example.com')->first();
        $this->assertNotNull($user->riderProfile);
    }
}
