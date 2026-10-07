<?php

namespace App\Http\Controllers;

use App\Models\VariantGroup;
use App\Models\VariantOption;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin CRUD for a variant group's options (e.g. "Large", "Extra Cheese").
 */
class VariantOptionController extends Controller
{
    /**
     * POST /api/admin/variant-groups/{variantGroup}/options
     */
    public function store(Request $request, VariantGroup $variantGroup): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'price_delta' => ['sometimes', 'numeric'],
            'is_default' => ['sometimes', 'boolean'],
            'is_available' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $option = $variantGroup->variantOptions()->create($data);

        return response()->json(['data' => $option->fresh()], 201);
    }

    /**
     * PUT/PATCH /api/admin/variant-options/{variantOption}
     */
    public function update(Request $request, VariantOption $variantOption): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'price_delta' => ['sometimes', 'numeric'],
            'is_default' => ['sometimes', 'boolean'],
            'is_available' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $variantOption->update($data);

        return response()->json(['data' => $variantOption->fresh()]);
    }

    /**
     * DELETE /api/admin/variant-options/{variantOption}
     */
    public function destroy(VariantOption $variantOption): JsonResponse
    {
        $variantOption->delete();

        return response()->json(['message' => 'Variant option deleted.']);
    }
}
