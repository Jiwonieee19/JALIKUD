<?php

namespace App\Http\Controllers;

use App\Http\Requests\Account\StoreAddressRequest;
use App\Models\Address;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * CRUD for the authenticated user's delivery addresses.
 *
 * These routes are what make a *delivery* order possible at all:
 * POST /api/orders requires an `address_id` owned by the caller whenever
 * `order_type` is `delivery`, so without a way to create an address a customer
 * who registered through the public API could only ever check out for pickup.
 */
class AddressController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $userId = (int) $request->user()->id;

        $addresses = Address::query()
            ->where('user_id', $userId)
            ->orderByDesc('is_default')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $addresses]);
    }

    public function store(StoreAddressRequest $request): JsonResponse
    {
        $data = $request->validated();
        $userId = (int) $request->user()->id;

        // A user's first address becomes their default implicitly, so the common
        // path ("save this address" with no is_default flag) still yields a
        // usable default for checkout UIs.
        $isFirst = ! Address::where('user_id', $userId)->exists();
        $data['is_default'] = $request->boolean('is_default') || $isFirst;

        $address = DB::transaction(function () use ($data, $userId) {
            if ($data['is_default']) {
                $this->clearOtherDefaults($userId);
            }

            return Address::create($data + ['user_id' => $userId]);
        });

        return response()->json([
            'message' => 'Address saved.',
            'data' => $address,
        ], 201);
    }

    public function update(StoreAddressRequest $request, Address $address): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $this->authorizeOwnership($address, $userId);

        // PATCH semantics: only the keys actually submitted are validated and
        // applied, so flipping is_default or editing one field does not demand
        // the full address again.
        $data = $request->validated();

        if (! $request->has('is_default')) {
            unset($data['is_default']);
        }

        $address = DB::transaction(function () use ($address, $data, $request, $userId) {
            // Only clear the other defaults when this address is actually being
            // promoted; an ordinary edit must not silently steal the default
            // flag from the address the user never touched.
            if ($request->boolean('is_default') && ! $address->is_default) {
                $this->clearOtherDefaults($userId);
            }

            $address->fill($data)->save();

            return $address;
        });

        return response()->json([
            'message' => 'Address updated.',
            'data' => $address,
        ]);
    }

    public function destroy(Request $request, Address $address): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $this->authorizeOwnership($address, $userId);

        $wasDefault = $address->is_default;

        DB::transaction(function () use ($address, $wasDefault, $userId) {
            $address->delete();

            // Promote the most recent survivor so the account is never left
            // without a default address for checkout.
            if ($wasDefault) {
                Address::where('user_id', $userId)
                    ->orderByDesc('created_at')
                    ->first()?->update(['is_default' => true]);
            }
        });

        return response()->json(['message' => 'Address removed.']);
    }

    /**
     * Addresses are private to their owner and the route-model-bound instance is
     * unfiltered, so ownership is checked explicitly. It is reported as a 422
     * rather than a 403 so the response does not confirm that the id exists.
     */
    private function authorizeOwnership(Address $address, int $userId): void
    {
        if ($address->user_id !== $userId) {
            throw ValidationException::withMessages([
                'address' => ['The selected address is invalid.'],
            ]);
        }
    }

    private function clearOtherDefaults(int $userId): void
    {
        Address::where('user_id', $userId)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }
}
