<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 30)->unique(); // e.g. ORD-20260915-0001
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('address_id')->nullable()->constrained()->nullOnDelete(); // null for pickup
            $table->foreignId('rider_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('assigned_at')->nullable();
            $table->string('order_type', 10); // delivery|pickup
            $table->string('status', 20)->default('pending');
            // pending|confirmed|preparing|ready|out_for_delivery|completed|cancelled
            $table->string('payment_status', 15)->default('unpaid'); // unpaid|paid|refunded|failed
            $table->string('payment_method', 30)->nullable();
            $table->decimal('subtotal', 10, 2);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('delivery_fee', 10, 2)->default(0);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2);
            $table->foreignId('coupon_id')->nullable()->constrained()->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestampTz('scheduled_for')->nullable(); // null = ASAP order
            $table->timestampTz('placed_at')->useCurrent();
            $table->timestamps();

            $table->index('user_id');
            $table->index('status');
            $table->index('placed_at');
            $table->index('rider_id');
        });

                if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_order_type_check CHECK (order_type IN ('delivery','pickup'))");
            DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled'))");
            DB::statement("ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('unpaid','paid','refunded','failed'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
