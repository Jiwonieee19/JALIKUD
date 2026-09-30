<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * API token lifecycle: changing the password revokes every other device
 * token, and issuing new tokens keeps the live-token count bounded.
 */
class TokenLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'Str0ngPassw0rd';

    public function test_changing_password_revokes_other_tokens_but_keeps_current_session(): void
    {
        $user = User::factory()->create(['password' => self::PASSWORD]);

        $current = $user->createToken('device-current')->plainTextToken;
        $other = $user->createToken('device-other')->plainTextToken;

        $this->putJson('/api/password', [
            'current_password' => self::PASSWORD,
            'password' => 'N3wStrongPass',
            'password_confirmation' => 'N3wStrongPass',
        ], ['Authorization' => "Bearer {$current}"])->assertStatus(200);

        // The token used to change the password still works.
        $this->withHeader('Authorization', "Bearer {$current}")
            ->getJson('/api/user')
            ->assertStatus(200);

        // Guard instances are memoised in the container between test requests,
        // so drop them to force real re-authentication with the next token.
        $this->app['auth']->forgetGuards();

        // Every other device token was revoked.
        $this->withHeader('Authorization', "Bearer {$other}")
            ->getJson('/api/user')
            ->assertStatus(401);

        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_new_password_works_and_old_password_does_not(): void
    {
        $user = User::factory()->create(['password' => self::PASSWORD]);
        Sanctum::actingAs($user);

        $this->putJson('/api/password', [
            'current_password' => self::PASSWORD,
            'password' => 'N3wStrongPass',
            'password_confirmation' => 'N3wStrongPass',
        ])->assertStatus(200);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'N3wStrongPass',
        ])->assertStatus(200)->assertJsonStructure(['token']);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => self::PASSWORD,
        ])->assertStatus(422);
    }

    public function test_login_prunes_tokens_beyond_the_per_user_cap(): void
    {
        $user = User::factory()->create(['password' => self::PASSWORD]);

        // 12 tokens already exist; the cap keeps the total at 12 after a new login.
        foreach (range(1, 12) as $ignored) {
            $user->createToken('old-'.$ignored);
        }

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => self::PASSWORD,
        ])->assertStatus(200);

        $this->assertSame(12, $user->tokens()->count());
    }
}
