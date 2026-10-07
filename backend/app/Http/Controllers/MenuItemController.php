<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\PaginationRequest;
use App\Models\MenuItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public listing + admin CRUD for menu items.
 */
class MenuItemController extends Controller
{
    public function index(PaginationRequest $request): JsonResponse
    {
        $items = MenuItem::query()
            ->when($request->query('category_id'), fn ($q, $cat) => $q->where('category_id', $cat))
            ->when($request->query('search'), function ($q, $search) {
                $q->where(function ($sub) use ($search) {
                    $sub->where('name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->when($request->query('available') === 'true', fn ($q) => $q->where('is_available', true))
            ->when($request->query('featured') === 'true', fn ($q) => $q->where('is_featured', true))
            ->with('category', 'variantGroups.options')
            ->orderBy('name')
            ->paginate($request->perPage(15));

        return response()->json(['data' => $items]);
    }

    public function show(MenuItem $menuItem): JsonResponse
    {
        $menuItem->load('category', 'variantGroups.options');

        return response()->json(['data' => $menuItem]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['required', 'string', 'max:180', 'unique:menu_items,slug'],
            'description' => ['nullable', 'string'],
            'sku' => ['nullable', 'string', 'max:50', 'unique:menu_items,sku'],
            'base_price' => ['required', 'numeric', 'min:0'],
            'image_url' => ['nullable', 'string'],
            'is_available' => ['boolean'],
            'is_featured' => ['boolean'],
            'preparation_time_minutes' => ['nullable', 'integer', 'min:0'],
            'calories' => ['nullable', 'integer', 'min:0'],
        ]);

        $item = MenuItem::create($data);

        return response()->json(['data' => $item], 201);
    }

    public function update(Request $request, MenuItem $menuItem): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['sometimes', 'exists:categories,id'],
            'name' => ['sometimes', 'string', 'max:150'],
            'slug' => ['sometimes', 'string', 'max:180', 'unique:menu_items,slug,'.$menuItem->id],
            'description' => ['nullable', 'string'],
            'sku' => ['nullable', 'string', 'max:50', 'unique:menu_items,sku,'.$menuItem->id],
            'base_price' => ['sometimes', 'numeric', 'min:0'],
            'image_url' => ['nullable', 'string'],
            'is_available' => ['boolean'],
            'is_featured' => ['boolean'],
            'preparation_time_minutes' => ['nullable', 'integer', 'min:0'],
            'calories' => ['nullable', 'integer', 'min:0'],
        ]);

        $menuItem->update($data);

        return response()->json(['data' => $menuItem]);
    }

    public function destroy(MenuItem $menuItem): JsonResponse
    {
        $menuItem->delete();

        return response()->json(['message' => 'Menu item deleted.']);
    }
}
