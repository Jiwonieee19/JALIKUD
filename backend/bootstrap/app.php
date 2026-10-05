<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Apply the named 'api' rate limiter (AppServiceProvider) to all api routes.
        $middleware->throttleApi();

        // Proxy trust is configured in AppServiceProvider::boot() instead of here.
        // This file is evaluated before Laravel boots dotenv, and under
        // `php artisan serve` the HTTP worker does not inherit $_SERVER, so
        // env()/$_SERVER/$_ENV/getenv() are all empty here and TRUSTED_PROXIES
        // would silently collapse to the 127.0.0.1 default — making every
        // proxied request share one rate-limit bucket.
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();