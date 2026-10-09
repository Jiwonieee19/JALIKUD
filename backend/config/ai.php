<?php

return [

    /*
    |--------------------------------------------------------------------------
    | AI Chat (Hosted LLM)
    |--------------------------------------------------------------------------
    |
    | The customer chat assistant calls an OpenAI-compatible chat-completions
    | API. This works with OpenAI, Groq, OpenRouter, DeepSeek, Together, etc. —
    | just set the base URL, model and API key. The mobile app never calls the
    | provider directly; it goes through POST /api/chat.
    |
    | Examples:
    |   OpenAI:      AI_BASE_URL=https://api.openai.com/v1      AI_MODEL=gpt-4o-mini
    |   Groq:        AI_BASE_URL=https://api.groq.com/openai/v1  AI_MODEL=llama-3.3-70b-versatile
    |   OpenRouter:  AI_BASE_URL=https://openrouter.ai/api/v1    AI_MODEL=openai/gpt-4o-mini
    |
    */

    'api_key' => env('AI_API_KEY'),

    'base_url' => env('AI_BASE_URL', 'https://api.openai.com/v1'),

    'model' => env('AI_MODEL', 'gpt-4o-mini'),

    'timeout' => (int) env('AI_TIMEOUT', 60),

];
