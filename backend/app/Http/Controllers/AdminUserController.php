<?php

namespace App\Http\Controllers;

use App\Http\Requests\Admin\ListUsersRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\RiderProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
    public function index(ListUsersRequest $request): JsonResponse
    {
        $perPage = $request->perPage(15);

        $users = User::query()
            ->when($request->query('search'), function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return $this->paginated($users, fn (User $u) => $this->present($u));
    }

    /**
     * POST /api/admin/users
     * Create a user with an explicit role.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'],
        ]);

        // Assign the role explicitly rather than spreading it into create():
        // 'role' is not mass-assignable, which keeps the public registration
        // endpoint from ever accepting one. StoreUserRequest still validates the
        // role against the enum; this assignment is what enforces it.
        $user->role = $data['role'] ?? User::ROLE_CUSTOMER;
        $user->save();

        $this->provisionRiderProfile($user);

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
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $data = $request->validated();

        if ($request->user()->id === $user->id
            && isset($data['role'])
            && $data['role'] !== User::ROLE_ADMIN) {
            throw ValidationException::withMessages([
                'role' => ['You cannot change your own role.'],
            ]);
        }

        $update = [
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? $user->phone,
        ];

        if (! empty($data['password'])) {
            $update['password'] = $data['password'];
        }

        $user->update($update);

        // 'role' is not mass-assignable, so it is applied explicitly. Setting it
        // separately also keeps the self-demotion guard above honest: that check
        // only fires when a role was actually submitted.
        if (array_key_exists('role', $data)) {
            $user->role = $data['role'];
            $user->save();
        }

        $this->provisionRiderProfile($user->fresh());

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
     * Ensure a rider account has a rider_profiles row so staff can assign it
     * without the rider first toggling availability in the app.
     */
    private function provisionRiderProfile(User $user): void
    {
        if ($user->role !== User::ROLE_RIDER) {
            return;
        }

        RiderProfile::firstOrCreate(['user_id' => $user->id], ['is_active' => true]);
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
            'phone' => $user->phone,
            'role' => $user->role,
            'created_at' => $user->created_at?->toIso8601String(),
            'deleted_at' => $user->deleted_at?->toIso8601String(),
        ];
    }
}
