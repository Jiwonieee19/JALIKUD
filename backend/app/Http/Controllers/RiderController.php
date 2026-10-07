<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\PaginationRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;

/**
 * Staff-facing rider directory used by the order-assignment picker.
 */
class RiderController extends Controller
{
    public function index(PaginationRequest $request): JsonResponse
    {
        $riders = User::query()
            ->where('role', User::ROLE_RIDER)
            ->with('riderProfile')
            ->orderBy('name')
            ->paginate($request->perPage(15));

        return response()->json(['data' => $riders]);
    }
}
