<?php

use App\Http\Controllers\AddressController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CouponController;
use App\Http\Controllers\MenuItemController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\StoreSettingController;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Support\Facades\Route;

// Public authentication endpoints (rate limited to slow down brute force)
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

// Protected endpoints (require Sanctum token)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::put('/password', [AuthController::class, 'updatePassword'])->middleware('throttle:password');
    Route::post('/logout', [AuthController::class, 'logout']);

    // Addresses (customer). Required for delivery checkout: POST /orders
    // demands an address_id owned by the caller when order_type=delivery, so
    // without these routes a customer who registered through the public API
    // could only ever check out for pickup.
    Route::get('/addresses', [AddressController::class, 'index']);
    Route::post('/addresses', [AddressController::class, 'store']);
    Route::match(['put', 'patch'], '/addresses/{address}', [AddressController::class, 'update']);
    Route::delete('/addresses/{address}', [AddressController::class, 'destroy']);

    // Cart (customer)
    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart/items', [CartController::class, 'addItem']);
    Route::put('/cart/items/{cart}/{cartItem}', [CartController::class, 'updateItem']);
    Route::delete('/cart/items/{cart}/{cartItem}', [CartController::class, 'removeItem']);
    Route::delete('/cart', [CartController::class, 'destroy']);
    Route::post('/cart/coupon', [CartController::class, 'applyCoupon'])->middleware('throttle:coupons');

    // Orders (customer)
    Route::get('/orders', [OrderController::class, 'index']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::post('/orders', [OrderController::class, 'store'])->middleware('throttle:orders');

    // Admin-only: all routes under /admin/*
    Route::middleware(EnsureAdmin::class)
        ->prefix('admin')
        ->group(function () {
            Route::get('/users', [AdminUserController::class, 'index']);
            Route::post('/users', [AdminUserController::class, 'store']);
            Route::get('/users/{user}', [AdminUserController::class, 'show']);
            Route::match(['put', 'patch'], '/users/{user}', [AdminUserController::class, 'update']);
            Route::delete('/users/{user}', [AdminUserController::class, 'destroy']);

            // Catalog management
            Route::apiResource('categories', CategoryController::class)->only(['store', 'update', 'destroy']);
            Route::apiResource('menu-items', MenuItemController::class)->only(['store', 'update', 'destroy']);
            Route::apiResource('coupons', CouponController::class)->except(['create', 'edit']);
            Route::put('/store-setting', [StoreSettingController::class, 'update']);

            // Order management
            Route::get('/orders', [OrderController::class, 'index']);
            Route::get('/orders/{order}', [OrderController::class, 'show']);
            Route::put('/orders/{order}/status', [OrderController::class, 'updateStatus']);
        });

});

// Public: catalog browsing (no auth required)
Route::get('/store-setting', [StoreSettingController::class, 'show']);
Route::get('/menu', [MenuItemController::class, 'index']);
Route::get('/menu/{menuItem}', [MenuItemController::class, 'show']);
Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/categories/{category}', [CategoryController::class, 'show']);
