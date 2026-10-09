<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\StoreSetting;
use App\Services\ChatbotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Customer chat assistant. The mobile app sends a message plus recent history;
 * this controller grounds the conversation in the live store menu, the caller's
 * cart and their active order, then proxies the prompt to a hosted LLM provider
 * (OpenAI-compatible). The provider is never exposed directly to the client.
 */
class ChatController extends Controller
{
    public function __construct(private readonly ChatbotService $chatbot) {}

    public function store(Request $request): JsonResponse
    {
        $messages = $this->buildMessages($request);

        try {
            $reply = $this->chatbot->chat($messages);
        } catch (\Throwable $e) {
            Log::error('Chat assistant request failed', ['error' => $e->getMessage()]);

            return response()->json([
                'message' => 'The assistant is temporarily unavailable. Please try again in a moment.',
            ], 503);
        }

        return response()->json(['data' => ['reply' => $reply]]);
    }

    /**
     * Stream the assistant's reply as Server-Sent Events (one token per event).
     */
    public function stream(Request $request): StreamedResponse
    {
        $messages = $this->buildMessages($request);

        return response()->stream(function () use ($messages) {
            try {
                $this->chatbot->stream($messages, function (string $token) {
                    $this->emit(['token' => $token]);
                });

                $this->emit(['done' => true]);
            } catch (\Throwable $e) {
                Log::error('Chat stream request failed', ['error' => $e->getMessage()]);

                $this->emit(['error' => 'The assistant is temporarily unavailable. Please try again in a moment.']);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream; charset=utf-8',
            'Cache-Control' => 'no-cache, no-transform',
            'X-Accel-Buffering' => 'no',
            'Connection' => 'keep-alive',
        ]);
    }

    /**
     * Validate the request and build the grounded message list for the provider.
     *
     * @return array<int, array{role: string, content: string}>
     */
    private function buildMessages(Request $request): array
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:1000'],
            'history' => ['sometimes', 'array', 'max:10'],
            'history.*.role' => ['required', 'string', 'in:user,assistant'],
            'history.*.content' => ['required', 'string', 'max:1000'],
        ]);

        return [
            ['role' => 'system', 'content' => $this->systemPrompt($request->user()->id)],
            ...collect($data['history'] ?? [])->map(fn (array $turn) => [
                'role' => $turn['role'],
                'content' => $turn['content'],
            ])->all(),
            ['role' => 'user', 'content' => $data['message']],
        ];
    }

    /**
     * Write a single Server-Sent Event to the open stream.
     *
     * @param  array<string, mixed>  $payload
     */
    private function emit(array $payload): void
    {
        echo 'data: '.json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n\n";

        if (ob_get_level() > 0) {
            ob_flush();
        }

        flush();
    }

    /**
     * Ground the assistant in the live store, menu, and this customer's context.
     */
    private function systemPrompt(int $userId): string
    {
        $settings = StoreSetting::query()->first();

        $lines = [
            'You are Jali, the JALIKUD food-ordering assistant. Answer briefly and helpfully in the language the customer is using (English or Tagalog). Only answer questions about JALIKUD ordering. Never invent menu items, prices, orders or store policy.',
        ];

        // Store snapshot.
        $store = ($settings?->store_name ?? 'JALIKUD')
            .'. Delivery fee ₱'.number_format((float) ($settings?->delivery_fee ?? 0), 2, '.', '')
            .', tax '.number_format((float) ($settings?->tax_rate_percent ?? 0), 2, '.', '').'%'
            .'. Accepts delivery: '.($settings?->accepts_delivery ? 'yes' : 'no')
            .', pickup: '.($settings?->accepts_pickup ? 'yes' : 'no')
            .'. '.($settings?->is_open ? 'Open now.' : 'Currently closed.');

        if ($settings?->opening_time !== null && $settings?->closing_time !== null) {
            $store .= ' Hours '.$settings->opening_time->format('H:i').'–'.$settings->closing_time->format('H:i').'.';
        }

        $lines[] = 'Store: '.$store;
        $lines[] = 'Payment: Cash on Delivery (COD) or GCash. Pickup orders must be paid with GCash.';

        // Menu summary, grouped by category.
        $menu = MenuItem::query()
            ->where('is_available', true)
            ->with('category:id,name')
            ->orderBy('category_id')
            ->orderBy('name')
            ->limit(60)
            ->get(['id', 'name', 'base_price', 'category_id']);

        if ($menu->isNotEmpty()) {
            $lines[] = 'Menu:';
            $lastCategory = null;

            foreach ($menu as $item) {
                $category = $item->category?->name ?? 'Other';

                if ($category !== $lastCategory) {
                    $lines[] = '  '.$category.':';
                    $lastCategory = $category;
                }

                $lines[] = '  - '.$item->name.' — ₱'.number_format((float) $item->base_price, 2, '.', '');
            }
        } else {
            $lines[] = 'Menu: currently unavailable.';
        }

        // Cart snapshot.
        $cart = Cart::query()->where('user_id', $userId)->with('cartItems.menuItem:id,name')->first();

        if ($cart !== null && $cart->cartItems->isNotEmpty()) {
            $items = $cart->cartItems
                ->map(fn ($line) => ((int) $line->quantity).'× '.($line->menuItem?->name ?? 'item'))
                ->all();

            $lines[] = "This customer's cart: ".implode(', ', $items).'.';
        } else {
            $lines[] = "This customer's cart is empty.";
        }

        // Active order snapshot.
        $active = Order::query()
            ->where('user_id', $userId)
            ->whereIn('status', [
                Order::STATUS_PENDING,
                Order::STATUS_CONFIRMED,
                Order::STATUS_PREPARING,
                Order::STATUS_READY,
                Order::STATUS_OUT_FOR_DELIVERY,
            ])
            ->latest('placed_at')
            ->first(['order_number', 'status', 'total_amount']);

        $lines[] = $active !== null
            ? "This customer's active order: {$active->order_number}, status '".str_replace('_', ' ', $active->status)."', total ₱".number_format((float) $active->total_amount, 2, '.', '').'.'
            : 'This customer has no active orders.';

        return implode("\n", $lines);
    }
}
