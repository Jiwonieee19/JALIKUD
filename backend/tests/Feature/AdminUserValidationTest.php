<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminUserValidationTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin']);
    }

    public function test_non_admin_is_forbidden(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/admin/users')->assertForbidden();
    }

    public function test_list_users_validates_per_page(): void
    {
        Sanctum::actingAs($this->admin());

        $this->getJson('/api/admin/users?per_page=abc')
            ->assertStatus(422)
            ->assertJsonValidationErrors('per_page');
    }

    public function test_store_user_rejects_invalid_role(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/admin/users', [
            'name' => 'Bob',
            'email' => 'bob@example.com',
            'password' => 'Str0ngPassw0rd',
            'role' => 'superuser',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('role');
    }

    public function test_store_user_rejects_duplicate_email(): void
    {
        $existing = User::factory()->create();
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/admin/users', [
            'name' => 'Bob',
            'email' => $existing->email,
            'password' => 'Str0ngPassw0rd',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_store_user_succeeds(): void
    {
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/admin/users', [
            'name' => 'Bob',
            'email' => 'bob@example.com',
            'password' => 'Str0ngPassw0rd',
            'role' => 'user',
        ])->assertStatus(201)
            ->assertJsonPath('data.email', 'bob@example.com');
    }

    public function test_update_user_accepts_missing_optional_password(): void
    {
        $admin = $this->admin();
        $target = User::factory()->create();
        Sanctum::actingAs($admin);

        $this->putJson("/api/admin/users/{$target->id}", [
            'name' => 'Updated Name',
            'email' => $target->email,
        ])->assertStatus(200)
            ->assertJsonPath('data.name', 'Updated Name');
    }

    public function test_update_user_rejects_short_password(): void
    {
        $target = User::factory()->create();
        Sanctum::actingAs($this->admin());

        $this->putJson("/api/admin/users/{$target->id}", [
            'name' => 'Updated Name',
            'email' => $target->email,
            'password' => 'short',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }
}
