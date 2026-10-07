<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\PaginationRequest;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Public listing + admin CRUD for menu categories.
 */
class CategoryController extends Controller
{
    public function index(PaginationRequest $request): JsonResponse
    {
        $categories = Category::query()
            ->when($request->query('active') === 'true', fn ($q) => $q->where('is_active', true))
            ->with('children')
            ->orderBy('sort_order')
            ->paginate($request->perPage(15));

        return response()->json(['data' => $categories]);
    }

    public function show(Category $category): JsonResponse
    {
        $category->load('children', 'menuItems');

        return response()->json(['data' => $category]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'parent_id' => ['nullable', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:100'],
            'slug' => ['required', 'string', 'max:120', 'unique:categories,slug'],
            'description' => ['nullable', 'string'],
            'image_url' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['boolean'],
        ]);

        $category = Category::create($data);

        return response()->json(['data' => $category], 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $request->validate([
            'parent_id' => ['nullable', 'exists:categories,id'],
            'name' => ['sometimes', 'string', 'max:100'],
            'slug' => ['sometimes', 'string', 'max:120', 'unique:categories,slug,'.$category->id],
            'description' => ['nullable', 'string'],
            'image_url' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['boolean'],
        ]);

        $category->update($data);

        return response()->json(['data' => $category]);
    }

    /**
     * DELETE /api/admin/categories/{category}
     *
     * A category that still has menu items assigned cannot be deleted: the
     * menu_items.category_id foreign key is RESTRICT, so the row would be
     * orphaned, and Postgres answers with a 500 (SQLSTATE 23503) otherwise.
     * Soft-deleted items still count — their category_id points here, and
     * deleting the category would strand them on restore. Move or delete the
     * items first. Child categories are safe: parent_id is NULL ON DELETE.
     */
    public function destroy(Category $category): JsonResponse
    {
        if ($category->menuItems()->withTrashed()->exists()) {
            throw ValidationException::withMessages([
                'category' => ['This category still has menu items assigned. Move or delete them first.'],
            ]);
        }

        $category->delete();

        return response()->json(['message' => 'Category deleted.']);
    }
}
