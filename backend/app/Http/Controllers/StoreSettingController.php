<?php

namespace App\Http\Controllers;

use App\Models\StoreSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read / update the single store-settings row.
 */
class StoreSettingController extends Controller
{
    public function show(): JsonResponse
    {
        $settings = StoreSetting::first();

        return response()->json(['data' => $settings]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'store_name' => ['required', 'string', 'max:150'],
            'is_open' => ['boolean'],
            'accepts_delivery' => ['boolean'],
            'accepts_pickup' => ['boolean'],
            'min_order_amount' => ['nullable', 'numeric', 'min:0'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'tax_rate_percent' => ['nullable', 'numeric', 'min:0'],
            'opening_time' => ['nullable', 'date_format:H:i'],
            'closing_time' => ['nullable', 'date_format:H:i'],
        ]);

        $settings = StoreSetting::first();

        if ($settings) {
            $settings->update($data);
        } else {
            $settings = StoreSetting::create($data);
        }

        return response()->json(['data' => $settings]);
    }
}
