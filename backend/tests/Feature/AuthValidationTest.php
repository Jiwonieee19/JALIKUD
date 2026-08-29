<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function validRegisterData(): array
    {
        return [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'password' => 'Str0ngPassw0rd',
            'password_confirmation' => 'Str0ngPassw0rd',
        ];
    }

    public function test_register_rejects_missing_name(): void
    {
        $this->postJson('/api/register', collect($this->validRegisterData())->except('name')->all())
            ->assertStatus(422)
            ->assertJsonValidationErrors('name');
    }

    public function test_register_rejects_invalid_email(): void
    {
        $data = $this->validRegisterData();
        $data['email'] = 'not-an-email';

        $this->postJson('/api/register', $data)
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_register_rejects_short_password(): void
    {
        $data = $this->validRegisterData();
        $data['password'] = 'short';
        $data['password_confirmation'] = 'short';

        $this->postJson('/api/register', $data)
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }

    public function test_register_rejects_mismatched_confirmation(): void
    {
        $data = $this->validRegisterData();
        $data['password_confirmation'] = 'different';

        $this->postJson('/api/register', $data)
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }

    public function test_register_succeeds_with_valid_input(): void
    {
        $this->postJson('/api/register', $this->validRegisterData())
            ->assertStatus(201)
            ->assertJsonStructure(['message', 'user', 'token']);
    }

    public function test_register_rejects_duplicate_email(): void
    {
        $this->postJson('/api/register', $this->validRegisterData());

        $this->postJson('/api/register', $this->validRegisterData())
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_login_requires_password(): void
    {
        $this->postJson('/api/login', ['email' => 'jane@example.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }
}
