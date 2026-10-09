<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // The chat tests fake the provider's HTTP response; give the service a
        // non-empty API key so it doesn't bail before the fake is consulted.
        config(['ai.api_key' => 'test-key']);
    }

    public function test_chat_returns_the_assistant_reply(): void
    {
        Http::fake([
            '*/chat/completions' => Http::response([
                'choices' => [['message' => ['role' => 'assistant', 'content' => 'Sure! The delivery fee is ₱49.00.']]],
            ]),
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_CUSTOMER]));

        $this->postJson('/api/chat', ['message' => 'How much is delivery?'])
            ->assertOk()
            ->assertJsonPath('data.reply', 'Sure! The delivery fee is ₱49.00.');
    }

    public function test_chat_requires_authentication(): void
    {
        $this->postJson('/api/chat', ['message' => 'hi'])->assertStatus(401);
    }

    public function test_chat_returns_503_when_the_provider_is_unavailable(): void
    {
        Http::fake(['*/chat/completions' => Http::response([], 500)]);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_CUSTOMER]));

        $this->postJson('/api/chat', ['message' => 'hi'])
            ->assertStatus(503)
            ->assertJsonPath('message', 'The assistant is temporarily unavailable. Please try again in a moment.');
    }

    public function test_chat_rejects_an_empty_message(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_CUSTOMER]));

        $this->postJson('/api/chat', ['message' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['message']);
    }

    public function test_chat_stream_emits_sse_token_events(): void
    {
        $body = implode("\n", [
            'data: '.json_encode(['choices' => [['delta' => ['content' => 'Hello']]]]),
            'data: '.json_encode(['choices' => [['delta' => ['content' => ' there']]]]),
            'data: [DONE]',
        ]);

        Http::fake(['*/chat/completions' => Http::response($body)]);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_CUSTOMER]));

        $response = $this->postJson('/api/chat/stream', ['message' => 'hi']);

        $response->assertOk();

        $streamed = $response->streamedContent();

        $this->assertStringContainsString('data: {"token":"Hello"}', $streamed);
        $this->assertStringContainsString('data: {"token":" there"}', $streamed);
        $this->assertStringContainsString('data: {"done":true}', $streamed);
    }

    public function test_chat_stream_emits_error_event_when_the_provider_fails(): void
    {
        Http::fake(['*/chat/completions' => Http::response([], 500)]);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_CUSTOMER]));

        $response = $this->postJson('/api/chat/stream', ['message' => 'hi']);

        $response->assertOk();

        $this->assertStringContainsString('data: {"error":', $response->streamedContent());
    }
}

