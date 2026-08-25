<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Admin-only user management (REST).
 *
 * All routes in this controller sit behind auth:sanctum + EnsureAdmin.
 */
class AdminUserController extends Controller
{
    /**
     * GET /api/admin/users
     * Paginated list of users.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, $request->integer('per_page', 15)));

        $users = User::query()
            ->when($request->query('search'), function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json([
            'data' => collect($users->items())->map(fn (User $u) => $this->present($u)),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
     * POST /api/admin/users
     * Create a user with an explicit role.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validateUser($request);

        $user = User::create([
            ...$data,
            'password' => $data['password'],
        ]);

        return response()->json([
            'message' => 'User created.',
            'data' => $this->present($user),
        ], 201);
    }

    /**
     * GET /api/admin/users/{user}
     */
    public function show(User $user): JsonResponse
    {
        return response()->json(['data' => $this->present($user)]);
    }

    /**
     * PUT/PATCH /api/admin/users/{user}
     * Update a user. Role changes are allowed but an admin cannot
     * demote themselves (would risk locking out the last admin).
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $data = $this->validateUser($request, $user, false);

        if ($request->user()->id === $user->id
            && isset($data['role'])
            && $data['role'] !== 'admin') {
            throw ValidationException::withMessages([
                'role' => ['You cannot change your own role.'],
            ]);
        }

        $update = [
            'name' => $data['name'],
            'email' => $data['email'],
        ];

        if (! empty($data['password'])) {
            $update['password'] = $data['password'];
        }

        if (array_key_exists('role', $data)) {
            $update['role'] = $data['role'];
        }

        $user->update($update);

        return response()->json([
            'message' => 'User updated.',
            'data' => $this->present($user),
        ]);
    }

    /**
     * DELETE /api/admin/users/{user}
     * An admin cannot delete their own account.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            throw ValidationException::withMessages([
                'user' => ['You cannot delete your own account.'],
            ]);
        }

        $user->delete();

        return response()->json([
            'message' => "User {$user->email} deleted.",
        ]);
    }

    /**
     * Shared validation for store/update.
     */
    private function validateUser(Request $request, ?User $user = null, bool $requirePassword = true): array
    {
        $emailRule = ['required', 'string', 'email', 'max:255'];
        if ($user) {
            $emailRule[] = Rule::unique('users', 'email')->ignore($user->id);
        } else {
            $emailRule[] = 'unique:users,email';
        }

        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => $emailRule,
            'password' => $requirePassword
                ? ['required', 'string', 'min:8']
                : ['sometimes', 'nullable', 'string', 'min:8'],
            'role' => ['sometimes', 'string', Rule::in(['user', 'admin'])],
        ]);
    }

    /**
     * Consistent public representation of a user.
     */
    private function present(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
