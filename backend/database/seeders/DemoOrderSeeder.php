<?php

namespace Database\Seeders;

use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\StoreSetting;
use App\Models\User;
use App\Services\PointLedger;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Two weeks of sample orders so every screen that reads orders has something real
 * to show: the admin Dashboard (revenue card, 7-day chart, rider counts, recent
 * orders) and the Orders page (every status tab populated, pagination across
 * pages, rider column populated).
 *
 * Design notes:
 *
 * - Prices are DERIVED from the menu, never hardcoded, so the totals agree with
 *   the catalogue. Tax and delivery fee are read from the live `store_settings`
 *   row and applied exactly the way `CartPricingService` does, so a seeded order
 *   and a real checkout of the same basket land on the same number.
 * - Timestamps are relative to the moment the seeder runs and span 7 days, so the
 *   dashboard's 7-day chart is always full regardless of when it is seeded.
 * - Every one of the seven statuses appears, including two cancelled orders so
 *   the dashboard's "gross of cancellations" revenue rule is visibly true rather
 *   than just claimed.
 * - Completed + paid orders are awarded through `PointLedger::awardForOrder()`,
 *   which is idempotent on the unique (order_id, reason) index. That populates
 *   `point_transactions`, so the Rewards admin ledger and the customer's
 *   /points endpoint have history rather than an empty table.
 *
 * Re-runnable: matched on the unique `order_number`. Child rows are replaced
 * rather than appended, so running it twice cannot duplicate items or history.
 * The `DEMO-` prefix makes the sample set identifiable and purgeable:
 *
 *   DELETE FROM orders WHERE order_number LIKE 'DEMO-%';
 *
 * ⚠️ Production never seeds. `docker-entrypoint.sh` runs `php artisan migrate
 *    --force` but no `db:seed`, so this must be run by hand per environment:
 *
 *   docker compose exec backend php artisan db:seed --class=DemoOrderSeeder
 */
class DemoOrderSeeder extends Seeder
{
    use WithoutModelEvents;

    /** Identifies the sample set and makes it purgeable by prefix. */
    public const PREFIX = 'DEMO-';

    /**
     * The sample orders.
     *
     * `hours_ago` is what spreads them across the chart's 7-day window.
     * `rider` assigns the demo rider, which is what makes `riders_on_delivery`
     * non-zero on the dashboard.
     *
     * @return array<int, array<string, mixed>>
     */
    private function orders(): array
    {
        return [
            // --- today -----------------------------------------------------
            ['lines' => [['chickenjoy-2pc', 1], ['jolly-spaghetti', 1]], 'status' => Order::STATUS_COMPLETED, 'type' => 'delivery', 'payment' => Order::PAYMENT_PAID, 'hours_ago' => 5, 'rider' => true],
            ['lines' => [['yumburger', 1], ['jolly-spaghetti', 2]], 'status' => Order::STATUS_OUT_FOR_DELIVERY, 'type' => 'delivery', 'payment' => Order::PAYMENT_UNPAID, 'hours_ago' => 3, 'rider' => true],
            ['lines' => [['chicken-burger-combo', 1]], 'status' => Order::STATUS_COMPLETED, 'type' => 'pickup', 'payment' => Order::PAYMENT_PAID, 'hours_ago' => 2, 'rider' => false],
            ['lines' => [['champ-burger', 2]], 'status' => Order::STATUS_PENDING, 'type' => 'delivery', 'payment' => Order::PAYMENT_UNPAID, 'hours_ago' => 1, 'rider' => false],

            // --- 1 day ago -------------------------------------------------
            ['lines' => [['chickenjoy-6pc', 1]], 'status' => Order::STATUS_COMPLETED, 'type' => 'delivery', 'payment' => Order::PAYMENT_PAID, 'hours_ago' => 26, 'rider' => true],
            ['lines' => [['burger-steak', 1]], 'status' => Order::STATUS_PREPARING, 'type' => 'delivery', 'payment' => Order::PAYMENT_UNPAID, 'hours_ago' => 28, 'rider' => false],

            // --- 2 days ago: one cancelled, so "gross of cancellations" shows --
            ['lines' => [['chickenjoy-8pc-family', 1], ['jolly-spaghetti', 3]], 'status' => Order::STATUS_COMPLETED, 'type' => 'delivery', 'payment' => Order::PAYMENT_PAID, 'hours_ago' => 50, 'rider' => true],
            ['lines' => [['champ-burger', 1], ['jolly-spaghetti', 1]], 'status' => Order::STATUS_CANCELLED, 'type' => 'delivery', 'payment' => Order::PAYMENT_REFUNDED, 'hours_ago' => 52, 'rider' => false],

            // --- 3 days ago ------------------------------------------------
            ['lines' => [['chickenjoy-1pc', 2], ['yumburger', 2]], 'status' => Order::STATUS_READY, 'type' => 'delivery', 'payment' => Order::PAYMENT_UNPAID, 'hours_ago' => 74, 'rider' => false],
            ['lines' => [['burger-steak-solo', 2]], 'status' => Order::STATUS_CONFIRMED, 'type' => 'pickup', 'payment' => Order::PAYMENT_UNPAID, 'hours_ago' => 76, 'rider' => false],

            // --- 4 days ago ------------------------------------------------
            ['lines' => [['chicken-burger-combo', 2]], 'status' => Order::STATUS_COMPLETED, 'type' => 'delivery', 'payment' => Order::PAYMENT_PAID, 'hours_ago' => 98, 'rider' => true],
            ['lines' => [['yumburger', 3]], 'status' => Order::STATUS_COMPLETED, 'type' => 'pickup', 'payment' => Order::PAYMENT_PAID, 'hours_ago' => 100, 'rider' => false],

            // --- 5 days ago ------------------------------------------------
            ['lines' => [['chickenjoy-2pc', 2]], 'status' => Order::STATUS_PREPARING, 'type' => 'delivery', 'payment' => Order::PAYMENT_UNPAID, 'hours_ago' => 122, 'rider' => false],
            ['lines' => [['chickenjoy-1pc', 1]], 'status' => Order::STATUS_CANCELLED, 'type' => 'delivery', 'payment' => Order::PAYMENT_FAILED, 'hours_ago' => 124, 'rider' => false],

            // --- 6 days ago ------------------------------------------------
            ['lines' => [['chickenjoy-6pc', 1], ['jolly-spaghetti', 2]], 'status' => Order::STATUS_COMPLETED, 'type' => 'delivery', 'payment' => Order::PAYMENT_PAID, 'hours_ago' => 146, 'rider' => true],
            ['lines' => [['burger-steak', 2]], 'status' => Order::STATUS_COMPLETED, 'type' => 'delivery', 'payment' => Order::PAYMENT_PAID, 'hours_ago' => 150, 'rider' => true],
        ];
    }

    /**
     * The status a real order would have passed through to reach $status, used
     * to fill order_status_history so the Orders detail timeline is not empty.
     *
     * @return array<int, string>
     */
    private function historyFor(string $status): array
    {
        $chain = [
            Order::STATUS_PENDING,
            Order::STATUS_CONFIRMED,
            Order::STATUS_PREPARING,
            Order::STATUS_READY,
            Order::STATUS_OUT_FOR_DELIVERY,
            Order::STATUS_COMPLETED,
        ];

        if ($status === Order::STATUS_CANCELLED) {
            return [Order::STATUS_PENDING, Order::STATUS_CANCELLED];
        }

        $index = array_search($status, $chain, true);

        return $index === false ? [Order::STATUS_PENDING] : array_slice($chain, 0, $index + 1);
    }

    public function run(): void
    {
        $purged = Order::query()->where('order_number', 'like', self::PREFIX.'%')->delete();

        $customers = User::where('role', User::ROLE_CUSTOMER)->get();
        $rider = User::where('role', User::ROLE_RIDER)->first();
        $staff = User::where('role', User::ROLE_STAFF)->first() ?? User::where('role', User::ROLE_ADMIN)->first();

        if ($customers->isEmpty()) {
            $this->command?->warn('No customers found. Run UserSeeder first.');

            return;
        }

        $menu = MenuItem::query()->whereIn('slug', array_unique(array_column(array_merge(...array_column($this->orders(), 'lines')), 0)))
            ->get()
            ->keyBy('slug');

        $missing = collect(array_merge(...array_column($this->orders(), 'lines')))
            ->map(fn (array $line) => $line[0])
            ->unique()
            ->reject(fn (string $slug) => $menu->has($slug));

        if ($missing->isNotEmpty()) {
            $this->command?->warn('Menu slugs missing (run MenuSeeder first): '.$missing->implode(', '));

            return;
        }

        $settings = StoreSetting::query()->first();

        $created = 0;

        foreach ($this->orders() as $index => $spec) {
            $this->createOrder(
                $spec,
                self::PREFIX.str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT),
                $customers[$index % $customers->count()],
                $rider,
                $staff,
                $menu,
                $settings,
            );
            $created++;
        }

        $awarded = $this->awardPoints();

        $this->command?->info("Seeded {$created} demo orders with prefix '".self::PREFIX."'.");
        $this->command?->line('  Replaced previous demo orders: '.$purged);
        $this->command?->line('  Loyalty transactions awarded: '.$awarded);
    }

    private function createOrder(
        array $spec,
        string $orderNumber,
        User $customer,
        ?User $rider,
        ?User $staff,
        $menu,
        ?StoreSetting $settings,
    ): void {
        $placedAt = Carbon::now()->subHours((int) $spec['hours_ago']);
        $isDelivery = $spec['type'] === 'delivery';

        $subtotal = 0.0;

        foreach ($spec['lines'] as [$slug, $quantity]) {
            $subtotal += (float) $menu[$slug]->base_price * $quantity;
        }

        $subtotal = round($subtotal, 2);

        // Mirrors CartPricingService: tax on the subtotal, delivery only for
        // deliveries, total = subtotal - discounts + fees + tax.
        $taxRate = (float) ($settings->tax_rate_percent ?? 0);
        $deliveryFee = $isDelivery ? (float) ($settings->delivery_fee ?? 0) : 0.0;
        $tax = round($subtotal * ($taxRate / 100), 2);
        $total = round($subtotal + $deliveryFee + $tax, 2);

        $order = Order::updateOrCreate(
            ['order_number' => $orderNumber],
            [
                'user_id' => $customer->id,
                'address_id' => $isDelivery ? $customer->addresses()->value('id') : null,
                'rider_id' => $spec['rider'] ? $rider?->id : null,
                'assigned_at' => $spec['rider'] ? $placedAt : null,
                'order_type' => $spec['type'],
                'status' => $spec['status'],
                'payment_status' => $spec['payment'],
                'payment_method' => $spec['payment'] === Order::PAYMENT_PAID ? 'gcash' : 'cod',
                'subtotal' => number_format($subtotal, 2, '.', ''),
                'discount_amount' => '0.00',
                'delivery_fee' => number_format($deliveryFee, 2, '.', ''),
                'tax_amount' => number_format($tax, 2, '.', ''),
                'total_amount' => number_format($total, 2, '.', ''),
                'notes' => null,
                'placed_at' => $placedAt,
            ],
        );

        // Children are replaced wholesale so a re-run cannot append duplicates.
        OrderItem::where('order_id', $order->id)->delete();
        OrderStatusHistory::where('order_id', $order->id)->delete();

        foreach ($spec['lines'] as [$slug, $quantity]) {
            $item = $menu[$slug];

            OrderItem::create([
                'order_id' => $order->id,
                'menu_item_id' => $item->id,
                'item_name' => $item->name,
                'unit_price' => number_format((float) $item->base_price, 2, '.', ''),
                'quantity' => $quantity,
                'subtotal' => number_format((float) $item->base_price * $quantity, 2, '.', ''),
            ]);
        }

        $this->createHistory($order, $spec['status'], $placedAt, $staff?->id);
    }

    private function createHistory(Order $order, string $status, Carbon $placedAt, ?int $staffId): void
    {
        $chain = $this->historyFor($status);
        $steps = max(1, count($chain));
        $gap = max(1, intdiv((int) $placedAt->diffInMinutes(Carbon::now()), $steps));

        foreach ($chain as $offset => $state) {
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $state,
                // The first row is the customer's own action, so it has no actor.
                'changed_by' => $offset === 0 ? null : $staffId,
                'note' => match ($state) {
                    $offset === 0 => 'Order placed.',
                    Order::STATUS_CANCELLED => 'Cancelled from the admin queue.',
                    default => null,
                },
                'created_at' => $placedAt->copy()->addMinutes($offset * $gap),
            ]);
        }
    }

    /**
     * Award points for the completed + paid demo orders. PointLedger::awardForOrder
     * is a no-op when the order is not both completed and paid, and is idempotent
     * on the unique (order_id, reason) index, so this is safe on every re-run.
     */
    private function awardPoints(): int
    {
        $awarded = 0;

        $orders = Order::query()->where('order_number', 'like', self::PREFIX.'%')->get();

        foreach ($orders as $order) {
            try {
                if (PointLedger::awardForOrder($order) !== null) {
                    $awarded++;
                }
            } catch (\Throwable $e) {
                $this->command?->warn('Could not award points for order '.$order->order_number.': '.$e->getMessage());
            }
        }

        return $awarded;
    }
}