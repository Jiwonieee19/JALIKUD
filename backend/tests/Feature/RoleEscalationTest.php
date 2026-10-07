<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Privilege-escalation guards.
 *
 * `role` was mass-assignable on User while the public register endpoint
 * defended against it only by omission - AuthController hand-built its insert
 * array and RegisterRequest had no `role` rule. Either one changing (a
 * `User::create($request->all())` refactor, or someone adding
 * `'role' => 'sometimes'`) would have let an anonymous caller self-promote to
 * admin on a publicly reachable API.
 *
 * `role` is now removed from $fillable and assigned explicitly at the two
 * call sites that legitimately need it, so mass assignment is structurally
 * unable to set it rather than merely unused.
 */
class RoleEscalationTest extends TestCase
{
    use RefreshDatabase;

    private function registrationPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Sneaky Person',
            'email' => 'sneaky@example.test',
            'password' => 'Secret123',
            'password_confirmation' => 'Secret123',
        ], $overrides);
    }

    public function test_role_is_not_mass_assignable(): void
    {
        // The structural defence: even a direct mass-assign attempt is ignored.
        $this->assertNotContains('role', (new User)->getFillable());

        $user = new User(['name' => 'X', 'role' => User::ROLE_ADMIN]);
        $this->assertNull($user->role);
    }

    public function test_public_registration_cannot_self_promote_to_admin(): void
    {
        $response = $this->postJson('/api/register', $this->registrationPayload([
            'role' => User::ROLE_ADMIN,
        ]))->assertStatus(201);

        // The extra key is ignored rather than rejected, and the account is a
        // plain customer.
        $this->assertSame(User::ROLE_CUSTOMER, $response->json('user.role'));
        $this->assertSame(User::ROLE_CUSTOMER, User::where('email', 'sneaky@example.test')->first()->role);
    }

    public function test_public_registration_cannot_request_any_elevated_role(): void
    {
        foreach ([User::ROLE_ADMIN, User::ROLE_STAFF, User::ROLE_RIDER] as $role) {
            $email = "escalate-{$role}@example.test";

            $this->postJson('/api/register', $this->registrationPayload([
                'email' => $email,
                'role' => $role,
            ]))->assertStatus(201);

            $this->assertSame(
                User::ROLE_CUSTOMER,
                User::where('email', $email)->first()->role,
                "Registering with role={$role} must not grant that role."
            );
        }
    }

    public function test_admin_created_users_still_receive_the_requested_role(): void
    {
        // Removing role from $fillable must not break the legitimate path.
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        Sanctum::actingAs($admin);

        $this->postJson('/api/admin/users', [
            'name' => 'New Rider',
            'email' => 'rider@example.test',
            'password' => 'Secret123',
            'password_confirmation' => 'Secret123',
            'role' => User::ROLE_RIDER,
        ])->assertStatus(201)->assertJsonPath('data.role', User::ROLE_RIDER);
    }

    public function test_admin_role_update_still_works(): void
    {
        // AdminUserController@update assigned role through mass assignment
        // before; it now assigns it explicitly.
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        $target = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        Sanctum::actingAs($admin);

        $this->putJson("/api/admin/users/{$target->id}", [
            'name' => $target->name,
            'email' => $target->email,
            'role' => User::ROLE_STAFF,
        ])->assertOk()->assertJsonPath('data.role', User::ROLE_STAFF);

        $this->assertSame(User::ROLE_STAFF, $target->fresh()->role);
    }

    public function test_an_admin_cannot_demote_themselves(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);
        Sanctum::actingAs($admin);

        $this->putJson("/api/admin/users/{$admin->id}", [
            'name' => $admin->name,
            'email' => $admin->email,
            'role' => User::ROLE_CUSTOMER,
        ])->assertStatus(422);

        $this->assertSame(User::ROLE_ADMIN, $admin->fresh()->role);
    }

    public function test_a_non_admin_cannot_create_a_user(): void
    {
        $customer = User::factory()->create(['role' => User::ROLE_CUSTOMER]);
        Sanctum::actingAs($customer);

        $this->postJson('/api/admin/users', $this->registrationPayload([
            'role' => User::ROLE_ADMIN,
        ]))->assertStatus(403);
    }
}
