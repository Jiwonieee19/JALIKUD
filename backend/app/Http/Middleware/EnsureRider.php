<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRider
{
    /**
     * Handle an incoming request. Only rider accounts may read their
     * delivery queue and advance its delivery-leg statuses.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user() || ! $request->user()->isRider()) {
            return response()->json([
                'message' => 'Forbidden. Rider access required.',
            ], 403);
        }

        return $next($request);
    }
}
