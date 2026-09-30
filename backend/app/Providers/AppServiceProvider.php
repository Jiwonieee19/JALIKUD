<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Applied to every api/* route via throttleApi() in bootstrap/app.php.
        RateLimiter::for('api', function (Request $request) {
            return $request->user()
                ? Limit::perMinute(120)->by('api-user:'.$request->user()->id)
                : Limit::perMinute(60)->by('api-ip:'.$request->ip());
        });

        // Stricter named limiters for abuse-prone endpoints.
        RateLimiter::for('orders', fn (Request $request) => Limit::perMinute(10)->by('orders:'.($request->user()?->id ?? $request->ip())));
        RateLimiter::for('coupons', fn (Request $request) => Limit::perMinute(6)->by('coupons:'.($request->user()?->id ?? $request->ip())));
        RateLimiter::for('password', fn (Request $request) => Limit::perMinute(5)->by('password:'.$request->user()->id));
    }
}