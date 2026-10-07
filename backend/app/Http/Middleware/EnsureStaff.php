<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStaff
{
    /**
     * Handle an incoming request. Staff and admins may operate the order
     * queue; customers and riders are refused. User/catalog/coupon/store
     * administration stays behind EnsureAdmin.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user() || ! $request->user()->isStaff()) {
            return response()->json([
                'message' => 'Forbidden. Staff access required.',
            ], 403);
        }

        return $next($request);
    }
}
