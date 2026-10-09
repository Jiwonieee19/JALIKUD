# Jali Chat Assistant — Setup Guide (Hosted LLM)

This document explains how to set up and run the "Ask Jali" chat assistant, which
grounds a hosted LLM (OpenAI, Groq, OpenRouter, or any OpenAI-compatible API) in
live store/menu/cart/order context.

## Architecture

```
Mobile app ──POST /api/chat (JSON)────────────► Laravel ──HTTPS──► Hosted LLM (chat completions)
          ──POST /api/chat/stream (SSE)────────►        (Guzzle)
```

The mobile app **never** talks to the LLM provider directly — your API key stays
server-side. Laravel proxies both endpoints:

| Endpoint | Mode | Response |
|---|---|---|
| `POST /api/chat` | Non-streaming | `{ "data": { "reply": "..." } }` |
| `POST /api/chat/stream` | Streaming (SSE) | `data: {"token":"..."}` events, then `data: {"done":true}` |

Both require a Sanctum bearer token (`Authorization: Bearer <token>`) and are
rate-limited (20/min per user/IP).

Because the provider is a plain HTTPS API, there is **no local model to run and
no Docker/loopback networking to configure** — the backend just makes an outbound
HTTPS call.

---

## 1. Choose a provider and get an API key

Any OpenAI-compatible provider works. Examples:

| Provider | `AI_BASE_URL` | Example `AI_MODEL` | Key from |
|---|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | https://platform.openai.com/api-keys |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | https://console.groq.com/keys |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` | https://openrouter.ai/keys |
| Gemini (Google AI Studio) | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-3.8-flash` | https://ai.google.dev/gemini-api/docs/get-started |

Groq and OpenRouter have free tiers, so they're a quick way to try this without
a credit card.

---

## 2. Configure the backend

Add these to `backend/.env` (copy from `.env.example` first if needed):

```dotenv
AI_API_KEY=your-key-here
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_TIMEOUT=60
```

- `AI_API_KEY` — your provider key (required; **never commit it**).
- `AI_BASE_URL` — the provider's chat-completions base URL.
- `AI_MODEL` — the model id on that provider.
- `AI_TIMEOUT` — seconds the backend waits for a reply.

The same values are wired through `docker-compose.yml`, so `docker compose up`
works with no extra networking.

---

## 3. Run the backend

```bash
cd backend
composer install
php artisan migrate --force          # if not already migrated
php artisan serve                    # local
# or: docker compose up --build
```

Confirm the routes:

```bash
php artisan route:list --path=chat
# POST api/chat        ChatController@store
# POST api/chat/stream ChatController@stream
```

Run the chat tests:

```bash
php vendor/bin/phpunit --filter ChatTest
```

---

## 4. Smoke-test the endpoints

Get a token first (via the app, or your existing auth flow). Then:

**Non-streaming:**

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is on the menu?"}'
```

**Windows (PowerShell):**

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/chat' -Method Post -Headers @{ Authorization = 'Bearer <TOKEN>' } -ContentType 'application/json' -Body '{"message":"What is on the menu?"}'
```

**Streaming (SSE):**

```bash
curl -N -X POST http://127.0.0.1:8000/api/chat/stream \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me about delivery", "history": []}'
```

**Windows (PowerShell)** — use the real curl with `-N` (no buffer) so tokens stream live:

```powershell
curl.exe -N -X POST http://127.0.0.1:8000/api/chat/stream -H "Authorization: Bearer <TOKEN>" -H "Accept: text/event-stream" -H "Content-Type: application/json" -d '{"message":"Tell me about delivery","history":[]}'
```

> **PowerShell note:** in PowerShell, `curl` is an alias for `Invoke-WebRequest`
> and won't accept `-d` / `-H`. Use `curl.exe` or `Invoke-RestMethod` (shown above).

You should see `data: {"token":"..."}` lines followed by `data: {"done":true}`.

---

## 5. Configure and run the mobile app

The mobile app reads its API URL from `EXPO_PUBLIC_API_URL`. Create `mobile/.env`:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000/api
```

> Use your machine's LAN IP (not `localhost`) when running on a physical device.

```bash
cd mobile
npm install
npx expo start
```

The "Ask Jali" widget streams replies token-by-token. If the backend or provider
is unreachable, it automatically falls back to the built-in rule-based answers.

---

## 6. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Widget shows the fallback answers only | Backend returned 503 (provider error) or network error. Check `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` and the backend logs. |
| `AI provider error: ...` in logs | The provider rejected the request — usually a bad key, model id, or exceeded quota. Read the `error.message`. |
| `The AI API key is not configured.` | `AI_API_KEY` is empty in `.env` (or not passed through Docker). |
| 401 responses | Missing/invalid `Authorization: Bearer` token — sign in on the app first. |
| No streaming on device | `expo/fetch` requires Expo SDK 52+ (this project is on SDK 57). Ensure `Accept: text/event-stream` reaches the endpoint. |
| Tokens arrive all at once | A proxy is buffering the SSE stream. `frontend/nginx.conf` already adds a `/api/chat/stream` location with `proxy_buffering off`; disable buffering for that path on any other proxy/CDN too. |

---

## How the context is grounded

`ChatController::systemPrompt()` injects, on every request:

- Store settings (name, delivery fee, tax %, delivery/pickup support, open/closed, hours)
- Payment rules (COD/GCash; pickup ⇒ GCash)
- A grouped menu summary (category + item name + price, capped at 60 items)
- The authenticated customer's cart contents
- Their active order status

The prompt is: `system prompt + last ~6 message turns + the new user message`, and
the assistant is instructed to be concise and never invent prices/items.
