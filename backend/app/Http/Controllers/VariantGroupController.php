<?php

namespace App\Http\Controllers;

use App\Models\MenuItem;
use App\Models\VariantGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin CRUD for a menu item's variant groups (e.g. "Size", "Add-ons").
 *
 * These routes are what make the variant system usable: CartPricingService
 * already prices and validates option selections, but without these there is
 * no way to attach a group (and its options) to an item via the API.
 */
class VariantGroupController extends Controller
{
    /**
     * GET /api/admin/menu-items/{menuItem}/variant-groups
     */
    public function index(MenuItem $menuItem): JsonResponse
    {
        $groups = $menuItem->variantGroups()
            ->with('options')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $groups]);
    }

    /**
     * POST /api/admin/menu-items/{menuItem}/variant-groups
     */
    public function store(Request $request, MenuItem $menuItem): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'selection_type' => ['sometimes', 'string', Rule::in(['single', 'multiple'])],
            'is_required' => ['sometimes', 'boolean'],
            'min_select' => ['sometimes', 'integer', 'min:0'],
            'max_select' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $group = $menuItem->variantGroups()->create($data);

        return response()->json(['data' => $group->fresh()->load('options')], 201);
    }

    /**
     * PUT/PATCH /api/admin/variant-groups/{variantGroup}
     */
    public function update(Request $request, VariantGroup $variantGroup): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'selection_type' => ['sometimes', 'string', Rule::in(['single', 'multiple'])],
            'is_required' => ['sometimes', 'boolean'],
            'min_select' => ['sometimes', 'integer', 'min:0'],
            'max_select' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $variantGroup->update($data);

        return response()->json(['data' => $variantGroup->fresh()->load('options')]);
    }

    /**
     * DELETE /api/admin/variant-groups/{variantGroup}
     */
    public function destroy(VariantGroup $variantGroup): JsonResponse
    {
        $variantGroup->delete();

        return response()->json(['message' => 'Variant group deleted.']);
    }
}
