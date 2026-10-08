<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

abstract class Controller
{
    /**
     * Serialise a paginator into the canonical list envelope:
     * `{ data: [...], meta: { current_page, per_page, total, last_page } }`.
     *
     * LengthAwarePaginator already emits its own `data` key, so wrapping it
     * again in `['data' => $paginator]` double-nests the rows at `data.data`
     * and breaks list rendering on the frontend.
     */
    protected function paginated(LengthAwarePaginator $paginator, ?callable $map = null): JsonResponse
    {
        $items = collect($paginator->items());

        if ($map !== null) {
            $items = $items->map($map);
        }

        return response()->json([
            'data' => $items->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }
}
