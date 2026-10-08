<?php

namespace App\Http\Controllers;

use App\Http\Requests\General\PaginationRequest;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
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

        return $this->paginated($categories);
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
            'slug' => ['sometimes', 'string', 'max:120', 'unique:categories,slug'],
            'description' => ['nullable', 'string'],
            'image_url' => ['nullable', 'string'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['boolean'],
        ]);

        if (empty($data['slug'] ?? null)) {
            $data['slug'] = $this->uniqueSlug($data['name']);
        }

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

        if (($data['parent_id'] ?? null) !== null && (int) $data['parent_id'] === $category->id) {
            return response()->json(['message' => 'A category cannot be its own parent.'], 422);
        }

        $category->update($data);

        return response()->json(['data' => $category]);
    }

    public function destroy(Category $category): JsonResponse
    {
        $count = $category->menuItems()->count();

        if ($count > 0) {
            throw ValidationException::withMessages([
                'category' => ["{$category->name} still has {$count} menu item(s). Move or remove them before deleting."],
            ]);
        }

        $category->delete();

        return response()->json(['message' => 'Category deleted.']);
    }

    /**
     * Derive a collision-free slug from the name when the client omits one.
     */
    private function uniqueSlug(string $name): string
    {
        $slug = Str::slug($name) ?: 'category';
        $base = $slug;
        $i = 1;

        while (Category::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.(++$i);
        }

        return $slug;
    }
}
