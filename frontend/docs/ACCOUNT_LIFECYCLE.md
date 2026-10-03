# Account Lifecycle

Who can create an account, with which role, and from where.

**Why this file exists:** the role model spans three clients and one database, and
there are three places where the logic is quietly incomplete. The backend hasn't
been finished yet, so this is the contract the person who finishes it should
implement against.

Related: [`API_WIRING.md`](./API_WIRING.md) (mock → endpoint map),
[`../src/types.ts`](../src/types.ts) (`UserRole` and friends).

---

## 1. The intended flow

```
                       ┌─────────────────────────────────────────┐
   ANONYMOUS           │  POST /api/register   (public, no auth)  │
   (mobile app  ───────▶  RegisterRequest: name, email, phone?,   │
    or web)             │                      password            │
                       │  AuthController@register:                 │
                       │    User::create({name,email,phone,        │
                       │                  password})   ← role NOT │
                       │                                          │
                       │  DB default fires → role = 'customer'    │
                       └─────────────────────────────────────────┘

                       ┌─────────────────────────────────────────┐
   ADMIN               │  POST /api/admin/users                   │
   (web only  ────────▶  requires Sanctum token + EnsureAdmin     │
    /admin/users)      │  StoreUserRequest validates:             │
                       │    role → Rule::in([customer, staff,     │
                       │                      admin, rider])     │
                       │  Creates with an EXPLICIT role          │
                       └─────────────────────────────────────────┘
```

**Summary:**

| Role | Self-registers on mobile? | Created by admin on web? | Can log into mobile? |
|---|---|---|---|
| `customer` | ✅ yes, public `POST /api/register` | optional | ✅ |
| `staff` | ❌ no | ✅ yes, role set explicitly | ✅ |
| `rider` | ❌ no | ✅ yes, role set explicitly | ✅ |
| `admin` | ❌ no | ✅ yes (but see §4.4) | ✅ |

**Staff and riders are hired, not self-served.** An admin provisions them on the
web, then the person signs in to the mobile app with those same credentials.

### ⚠️ Do not add a role picker to mobile register

`mobile/src/app/register.tsx` correctly has none, and
`mobile/src/context/auth-demo-context.tsx:98` hardcodes `role: 'customer'`.
That is the intended behaviour — keep it that way through integration.

---

## 2. The public endpoint has no role guard

### 2.1 `role` is mass-assignable

```php
// backend/app/Models/User.php:15
#[Fillable(['name', 'email', 'phone', 'password', 'role'])]
```

This is safe **right now only by luck.** Two things happen to prevent
exploitation, and neither is a deliberate defence:

1. `AuthController@register` (`backend/app/Http/Controllers/AuthController.php:25-30`)
   hand-builds the insert array and omits `role`.
2. `RegisterRequest::rules()` (`backend/app/Http/Requests/Auth/RegisterRequest.php:18-27`)
   has no `role` key, so `validated()` cannot return it.

The admin path **is** properly guarded — `StoreUserRequest.php:23` constrains
`role` to the enum, behind `EnsureAdmin`.

The public path has **no guard whatsoever.** One refactor from a critical
vulnerability:

```php
// backend/app/Http/Controllers/AuthController.php:25
User::create($request->all())     // ← anonymous caller POSTs {"role":"admin"}
```

or someone adds `'role' => 'sometimes'` to `RegisterRequest`, and anyone can
self-promote to admin.

**Fix (defence in depth):** drop `role` from the `Fillable` attribute and assign
it explicitly at the two call sites that legitimately need it:

```php
// public register
$user = User::create([
    'name' => $data['name'],
    'email' => $data['email'],
    'phone' => $data['phone'] ?? null,
    'password' => $data['password'],
    'role' => User::ROLE_CUSTOMER,      // explicit, not defaulted
]);

// admin create
$user = new User([...$data]);
$user->role = $data['role'] ?? User::ROLE_CUSTOMER;
$user->save();
```

Keep `StoreUserRequest`'s enum check — it validates the *intent*, the explicit
assignment is what enforces it. A Postgres `CHECK` constraint
(`users_role_check`, migration `..._000001_create_users_table.php:26-27`) exists
as a last line of defence, but it only rejects invalid roles, it does not stop
`admin`.

**Regression test to add:** `POST /api/register` with
`{"role":"admin"}` must return a `customer`, not a `422` and not an admin.

---

## 3. Creating a rider does not create the `rider_profiles` row

`AdminUserController@store` (`backend/app/Http/Controllers/AdminUserController.php:53-67`)
only does `User::create([...$data])`. **Nothing anywhere writes `RiderProfile`.**

Verified: zero `RiderProfile::` writes in `app/`, no observer, no event
listener, and `AppServiceProvider::boot()` (`backend/app/Providers/AppServiceProvider.php:20`)
is empty.

But the schema declares a strict 1:1:

```php
// backend/database/migrations/2026_09_15_000003_create_rider_profiles_table.php:13
$table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
```

and the relation exists:

```php
// backend/app/Models/User.php:61-63
public function riderProfile(): HasOne { return $this->hasOne(RiderProfile::class); }
```

**Consequence:** admin creates a rider on the web → the `users` row exists, the
`rider_profiles` row does not. Then `$user->riderProfile` is `null`, and every
rider-facing endpoint and screen that needs it fails or silently returns nothing.

Note this will **not** surface as a DB error — every other column is nullable and
`is_active` defaults to `true` (`:15-18`). It is purely an application-layer
omission, which makes it easy to miss.

Staff has **no** secondary table — staff is just `role='staff'` on `users`, so
staff provisioning is already complete. **Rider is the only role that needs a
second row.**

**Fix:** create the profile whenever the role becomes `rider`. A `created`
observer is cleaner than a controller branch, because it also covers
role-change-to-rider:

```php
// app/Observers/UserObserver.php
public function created(User $user): void
{
    if ($user->role === User::ROLE_RIDER) {
        RiderProfile::create(['user_id' => $user->id]);
    }
}
```

Register it in `AppServiceProvider::boot()`:

```php
User::observe(UserObserver::class);
```

---

## 4. Other gaps in the same area

### 4.1 `name` is one field — do not split it

```
backend/database/migrations/2026_09_15_000001_create_users_table.php:14
  $table->string('name', 150);
```

There is **no** `first_name` / `last_name` column. Every form (register, profile,
admin user create/edit) collects a single "Full name" input and sends one `name`
value.

A first/last split was built and then **deliberately reverted**, because the
frontend should mirror the schema rather than paper over it. Keep it that way.

Two consequences to be aware of, neither of which is a bug:
- you cannot sort or filter users by surname — `ORDER BY name` groups by first name
- personalising a greeting is a heuristic, since `name` is an unvalidated free string

If the team later decides separate columns are worth it, the change is: new
migration on `users`, then update `RegisterRequest`, `UpdateProfileRequest`,
`StoreUserRequest`, `UpdateUserRequest`, the `User` model,
`AuthController@register`, `AdminUserController::store/update/present`, and
`User`/`AdminUser` in `frontend/src/types.ts`. Backfill by splitting the existing
`name` values on the first space.

**Column width mismatch (fix this either way):** the migration declares
`string('name', 150)` while `RegisterRequest`, `UpdateProfileRequest` and
`StoreUserRequest` all validate `max:255`. Laravel will accept 200 characters
and then Postgres will reject or truncate. Widen the column, or tighten the
rules to 150.

### 4.2 Role demotion leaves an orphan profile

Changing a rider → `customer` leaves the `rider_profiles` row behind, with
`is_active` still `true`. Nothing reads it, so it won't crash — but decide
deliberately:

- **deactivate** (`is_active = false`) to preserve the delivery history, or
- **cascade delete** via `rider_profiles.user_id`'s `cascadeOnDelete()` firing
  manually

Recommendation: **deactivate.** Orders reference riders historically
(`orders.rider_id`), so deleting the profile loses delivery attribution for past
orders.

### 4.3 `isRider()` is never called

`User::isRider()` (`backend/app/Models/User.php:51-53`) has **zero call sites**
in the entire backend. So `rider` accounts have no capability distinction from
`customer` beyond the shared cart/order routes.

Likewise `bootstrap/app.php`'s `withMiddleware` closure is empty — **no
middleware aliases are registered at all.** Any new role middleware has to be
registered there.

### 4.4 Admin cannot self-demote (already correct — keep it)

```php
// backend/app/Http/Controllers/AdminUserController.php:86-90
if ($request->user()->id === $user->id && isset($data['role']) && $data['role'] !== User::ROLE_ADMIN) {
    throw ValidationException::withMessages(['role' => ['You cannot change your own role.']]);
}
```

This mirrors the frontend mock (`src/mock/adminUsersApi.ts`), which also rejects
the change. Note it only blocks *demotion* — an admin editing their own name or
email is still allowed, which is correct.

### 4.5 First admin must be promoted by hand

`DatabaseSeeder` creates **no users** — only the `store_settings` row. So
`POST /api/admin/users` is unreachable on a fresh database (it needs an admin
token, but no admin exists). Bootstrap manually:

```sql
UPDATE users SET role='admin', updated_at=now() WHERE email='you@email.com';
```

### 4.6 Mobile's demo accounts are throwaway — do not migrate them

- `mobile/src/context/auth-demo-context.tsx:75` compares passwords with a
  plaintext `===`
- `mobile/src/app/login.tsx:145` prints the shared demo password `demo1234`
  on screen
- `auth-demo-context.tsx:3-4` states it outright: *"Nothing here is persisted —
  restarting the app resets every account back to the seeded demo users."*

These are in-memory fixtures, not a credential store. They must not be carried
into integration, and the on-screen password disclosure should be removed at the
same time.

---

## 5. Checklist for the backend implementer

- [ ] Remove `role` from `User`'s `Fillable`; assign explicitly per §2.1
- [ ] Add a regression test: `POST /api/register {"role":"admin"}` → `customer`
- [ ] Add `UserObserver` that creates `RiderProfile` when role is `rider` (§3)
- [ ] Register the observer in `AppServiceProvider::boot()`
- [ ] Decide + implement role-demotion behaviour for `rider_profiles` (§4.2)
- [ ] Add `EnsureStaff` / `EnsureRole` middleware and register the alias (§4.3)
- [ ] Call `isRider()` from the new rider middleware
- [ ] Document the manual first-admin promotion in `backend/README.md` (§4.5)
- [ ] Confirm `POST /api/register` never accepts a role, even optional

### Frontend / mobile

- [ ] Mobile register keeps **no** role picker (§1)
- [ ] Web `/admin/users` already has the role dropdown (`src/pages/AdminUsersPage.tsx:342-354`) — no change needed
- [ ] Delete the on-screen demo password on `mobile/src/app/login.tsx:145` (§4.6)

### Open design question

`rider_profiles` has `vehicle_type` (`motorcycle|bicycle|car`) and
`plate_number`. The web `/admin/users` form does **not** collect these — it
assigns a role and nothing else. Decide whether creating a rider should also
require vehicle details, and if so that becomes a conditional section on the
form. Not implemented either way.