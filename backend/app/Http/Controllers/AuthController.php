<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Maximum live tokens kept per user; older ones are pruned on each login.
     */
    private const MAX_TOKENS_PER_USER = 12;

    /**
     * Register a new customer account.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'],
        ]);

        // 'role' is deliberately NOT mass-assignable (see User::$fillable), so
        // the public registration path can never set it. Assign it explicitly so
        // a new account is always a customer rather than relying on a nullable
        // column default. Set ROLE_CUSTOMER here deliberately: if a rider or
        // staff account is ever wanted, create it through /api/admin/users,
        // which validates the role against the enum.
        $user->role = User::ROLE_CUSTOMER;
        $user->save();

        return response()->json([
            'message' => 'Registration successful.',
            'user' => $user,
            'token' => $this->issueToken($user),
        ], 201);
    }

    /**
     * Issue an API token, pruning the oldest tokens beyond the per-user cap
     * so abandoned sessions cannot accumulate forever.
     */
    private function issueToken(User $user): string
    {
        $token = $user->createToken('auth-token');

        $stale = $user->tokens()
            ->orderByDesc('id')
            ->skip(self::MAX_TOKENS_PER_USER)
            ->take(50)
            ->pluck('id');

        if ($stale->isNotEmpty()) {
            $user->tokens()->whereIn('id', $stale)->delete();
        }

        return $token->plainTextToken;
    }

    /**
     * Issue an API token for the credentials flow.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        return response()->json([
            'message' => 'Login successful.',
            'user' => $user,
            'token' => $this->issueToken($user),
        ]);
    }

    /**
     * return authenticated user
     */
    public function user(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user(),
        ]);
    }

    /**
     * Update the authenticated user's profile (name / email).
     */
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validated();

        $user->update($data);

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $user->fresh(),
        ]);
    }

    /**
     * Change the authenticated user's password and revoke every other
     * session/device token so a leaked token dies with the password.
     */
    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()?->id;

        $user->update([
            'password' => $data['password'],
        ]);

        $user->tokens()
            ->when($currentTokenId !== null, fn ($query) => $query->whereKeyNot($currentTokenId))
            ->delete();

        return response()->json([
            'message' => 'Password changed successfully. Other sessions were signed out.',
        ]);
    }

    /**
     * revoke the current access token
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }
}
