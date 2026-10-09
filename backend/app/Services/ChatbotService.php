<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Thin wrapper around an OpenAI-compatible chat-completions API (OpenAI, Groq,
 * OpenRouter, DeepSeek, Together, ...). The backend is the only thing that talks
 * to the provider; the mobile app goes through POST /api/chat instead.
 */
class ChatbotService
{
    /**
     * Send a conversation to the provider and return the assistant's reply.
     *
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public function chat(array $messages): string
    {
        $response = $this->request(false, $messages);

        if ($response->failed()) {
            throw new RuntimeException($this->errorMessage($response));
        }

        $content = $response->json('choices.0.message.content');

        if (! is_string($content) || trim($content) === '') {
            throw new RuntimeException('The assistant returned an empty reply.');
        }

        return $content;
    }

    /**
     * Stream a conversation from the provider, invoking $onToken for each token.
     *
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  callable(string): void  $onToken
     */
    public function stream(array $messages, callable $onToken): void
    {
        $response = $this->request(true, $messages);

        if ($response->failed()) {
            throw new RuntimeException($this->errorMessage($response));
        }

        $body = $response->toPsrResponse()->getBody();
        $buffer = '';

        while (! $body->eof()) {
            $buffer .= $body->read(8192);

            while (($newline = strpos($buffer, "\n")) !== false) {
                $line = substr($buffer, 0, $newline);
                $buffer = substr($buffer, $newline + 1);
                $this->dispatchToken($line, $onToken);
            }
        }

        if (trim($buffer) !== '') {
            $this->dispatchToken($buffer, $onToken);
        }
    }

    /**
     * POST to the provider's chat-completions endpoint.
     *
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    private function request(bool $stream, array $messages): Response
    {
        $base = rtrim((string) config('ai.base_url', ''), '/');
        $key = (string) config('ai.api_key', '');

        if ($base === '') {
            throw new RuntimeException('The AI base URL is not configured.');
        }

        if ($key === '') {
            throw new RuntimeException('The AI API key is not configured.');
        }

        $pending = Http::withToken($key)->timeout((int) config('ai.timeout', 60));

        if ($stream) {
            $pending = $pending->withOptions(['stream' => true]);
        }

        return $pending->post($base.'/chat/completions', [
            'model' => (string) config('ai.model'),
            'stream' => $stream,
            'messages' => $messages,
        ]);
    }

    /**
     * Decode a single SSE "data:" line and forward its delta content (one token).
     *
     * @param  callable(string): void  $onToken
     */
    private function dispatchToken(string $line, callable $onToken): void
    {
        $line = trim($line);

        if ($line === '' || ! str_starts_with($line, 'data:')) {
            return;
        }

        $data = trim(substr($line, 5));

        if ($data === '[DONE]') {
            return;
        }

        $chunk = json_decode($data, true);

        if (! is_array($chunk)) {
            return;
        }

        $token = $chunk['choices'][0]['delta']['content'] ?? '';

        if (is_string($token) && $token !== '') {
            $onToken($token);
        }
    }

    /**
     * Pull a human-readable message out of a failed provider response.
     */
    private function errorMessage(Response $response): string
    {
        $message = $response->json('error.message');

        if (is_string($message) && $message !== '') {
            return 'AI provider error: '.$message;
        }

        return 'AI provider responded with status '.$response->status();
    }
}

