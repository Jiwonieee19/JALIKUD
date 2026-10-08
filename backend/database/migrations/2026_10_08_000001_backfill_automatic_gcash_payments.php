<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('orders')
            ->where('payment_method', 'gcash')
            ->where('payment_status', 'unpaid')
            ->where('status', '!=', 'cancelled')
            ->orderBy('id')
            ->chunkById(100, function ($orders): void {
                foreach ($orders as $order) {
                    DB::table('orders')->where('id', $order->id)->update(['payment_status' => 'paid']);

                    if (! DB::table('payments')->where('order_id', $order->id)->where('status', 'succeeded')->exists()) {
                        DB::table('payments')->insert([
                            'order_id' => $order->id,
                            'provider' => 'gcash',
                            'provider_transaction_id' => 'demo-backfill-'.$order->id,
                            'amount' => $order->total_amount,
                            'currency' => 'PHP',
                            'status' => 'succeeded',
                            'paid_at' => now(),
                            'raw_response' => json_encode(['source' => 'automatic_gcash_backfill']),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            });
    }

    public function down(): void
    {
        $payments = DB::table('payments')
            ->where('provider_transaction_id', 'like', 'demo-backfill-%')
            ->get(['id', 'order_id']);

        foreach ($payments as $payment) {
            DB::table('orders')
                ->where('id', $payment->order_id)
                ->where('payment_status', 'paid')
                ->update(['payment_status' => 'unpaid']);
        }

        DB::table('payments')->where('provider_transaction_id', 'like', 'demo-backfill-%')->delete();
    }
};
