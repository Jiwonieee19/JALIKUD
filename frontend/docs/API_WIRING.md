# API Wiring Guide

This frontend was built **design-first**. Every screen reads from `src/mock/`
so the app runs standalone with no backend. This file is the map from each
mock to the real endpoint it stands in for.

**Whoever picks up the integration:** work top to bottom. Each mock file has the
same information in a header comment, so you can `grep -rn "stands in for" src/`.

---

## 1. How to run it right now

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

No backend required. Log in with **any** email and any password that is 8+
characters containing an uppercase letter and a digit (e.g. `Password123`).
The session user is hard-coded to `mockCurrentUser` in `src/mock/users.ts`.

---

## 2. The three files that matter most

| File | Role |
|---|---|
| `src/types.ts` | Domain contract. The first 245 lines mirror the Laravel serialisers **exactly** — do not change them without changing the backend. |
| `src/mock/` | Fake data. Delete this directory once integration is done. |
| `src/services/api.ts` | **Untouched.** Axios instance, `baseURL: '/api'`, bearer token from `localStorage`. Ready to use. |

---

## 3. Mock → endpoint map

### Auth — `src/context/AuthContext.tsx`
Currently mocked. Restore `import api from '../services/api'`.

| Mock behaviour | Real call |
|---|---|
| any strong password logs in | `POST /api/register`, `POST /api/login` |
| session always `mockCurrentUser` | `GET /api/user` on mount |
| logout clears localStorage only | add `await api.post('/logout')` |

Token is stored under `localStorage.auth_token` by `src/services/api.ts`.

⚠️ **The backend seeds no users.** The first admin must be promoted manually
before any `/admin/users` call will succeed:

```sql
UPDATE users SET role='admin', updated_at=now() WHERE email='you@email.com';
```

### Admin users — `src/mock/adminUsersApi.ts`
| Method | Real call |
|---|---|
| `list()` | `GET /admin/users?search=&page=` |
| `store()` | `POST /admin/users` |
| `update()` | `PUT /admin/users/{id}` |
| `destroy()` | `DELETE /admin/users/{id}` |

Mock validation already mirrors `StoreUserRequest` / `UpdateUserRequest`,
including `You cannot change your own role.` and Laravel's 422 shape
(`{ message, errors: { field: [msg] } }`). The page's error handling works
unchanged once the real client is swapped in.

### Menu — `src/pages/AdminMenuPage.tsx`, data in `src/mock/menu.ts`
| Real call | Auth |
|---|---|
| `GET /menu`, `GET /menu/{menu_item}` | public |
| `GET /categories`, `GET /categories/{category}` | public |
| `POST/PUT/PATCH/DELETE /admin/categories[/{id}]` | admin |
| `POST/PUT/PATCH/DELETE /admin/menu-items[/{id}]` | admin |

### Orders — `src/pages/AdminOrdersPage.tsx`, data in `src/mock/orders.ts`
| Real call | Auth |
|---|---|
| `GET /admin/orders` | admin |
| `GET /admin/orders/{order}` | admin |
| `PUT /admin/orders/{order}/status` — body `{ status, note? }` | admin |

The `FLOW` map in the page mirrors the `orders_status_check` CHECK constraint
(`pending → confirmed → preparing → ready → out_for_delivery → completed`,
with `cancelled` reachable up to `ready`).

### Coupons — `src/pages/AdminCouponsPage.tsx`, data in `src/mock/store.ts`
| Real call | Auth |
|---|---|
| `GET/POST /admin/coupons` | admin |
| `PUT/PATCH/DELETE /admin/coupons/{coupon}` | admin |

### Store settings — `src/pages/AdminSettingsPage.tsx`
| Real call | Auth |
|---|---|
| `GET /store-setting` | public |
| `PUT /admin/store-setting` | admin |

### Dashboard — `src/pages/DashboardPage.tsx`, data in `src/mock/overview.ts`
See §4 — **the endpoint does not exist yet.**

---

## 4. Endpoints that do not exist yet

These are invented for design purposes. They need backend work before the
matching screens can go live.

### `GET /api/admin/overview`
The Dashboard is fed by `mockOverview`, an `AdminOverview` object defined at the
bottom of `src/types.ts`. There is no stats route in `backend/routes/api.php`.

Suggested implementation: one aggregate query returning `revenue_today`,
`orders_today`, `active_orders`, `completed_today`, `cancelled_today`,
`pending_orders`, `sold_out_items`, `menu_items_total`, rider counts by status,
and `store_open`. `mockRevenueSeries` needs a second aggregate grouped by date.

Note revenue should exclude cancelled orders — refunded money is not revenue.

### `POST/PUT /api/admin/orders/{order}/rider`
The "Assign a rider" modal on the Orders page is entirely mock. The schema
already supports it — `orders.rider_id` exists and `Order::rider()` is defined —
but there is no endpoint and no rider listing.

Needs:
- `GET /admin/riders` — returns `RiderProfile[]` (`src/types.ts`), filterable by `status`
- `PUT /admin/orders/{order}/rider` — body `{ rider_id }`, should also stamp `assigned_at`

### Rider self-service — `GET /api/rider/deliveries`
Riders currently have no endpoints whatsoever. `RiderProfile` has zero routes.

Needs `GET /rider/deliveries`, `GET /rider/deliveries/{order}`, and
`PUT /rider/deliveries/{order}/status`. Also needs an `EnsureRider` middleware —
`User::isRider()` exists but is never called, and `bootstrap/app.php` registers no
middleware aliases at all.

### Rewards / redemption — `/admin/rewards`
**Nothing exists.** No `Reward` model, no migration, no endpoint. It is named in
the project proposal three times, and `backend/DATABASE_SCHEMA.md` designs three
tables (`rewards`, `reward_redemptions`, `reward_point_transactions`) — but
nothing is built. The route currently renders a placeholder.

The mobile app has a static demo at `mobile/src/app/(tabs)/rewards.tsx`
(2450 points, 6 redeemables) worth using as a starting point.

### Variant groups — no write endpoints
`MenuItemController@index` eager-loads `variantGroups.options`
(`MenuItemController.php:21`) and the tables exist, but `VariantGroup` and
`VariantOption` have **zero routes**. Variants are read-only today. Writing them
needs `POST/PUT/DELETE /admin/menu-items/{item}/variant-groups` and
`POST/PUT/DELETE /admin/variant-groups/{group}`.

---

## 4b. Existing endpoints that need changing

These **do** exist but are too thin for the screens already built against them.
Verified by reading the controllers, not inferred.

### `GET /api/admin/orders` — missing eager loads
```php
// backend/app/Http/Controllers/OrderController.php:22-29
$query = Order::query()->orderByDesc('placed_at');
...
$orders = $query->paginate($request->perPage(10));
```
Only `show()` calls `->with([...])` (`:40`). The Orders table renders the
customer name and item count per row, both of which will be blank. Needs at
minimum:
```php
->with(['user:id,name', 'rider:id,name', 'orderItems:id,order_id'])
```

### `GET /api/admin/orders` — no status/search filters
`PaginationRequest` (`app/Http/Requests/General/PaginationRequest.php:20-21`)
accepts **only** `page` and `per_page`. The Orders page filters status and search
in the browser, which silently only ever filters page 1.

Two options:
- add `status` + `search` filters to `OrderController@index` **and** pagination
  UI to the page, or
- request `per_page=100` and keep client-side filtering — sensible if one
  restaurant only handles hundreds of orders per year

### `GET /api/menu` — no search, 15 per page
```php
// backend/app/Http/Controllers/MenuItemController.php:17-23
```
Supports `category_id`, `available`, `featured` and eager-loads `category` +
`variantGroups.options`. But there is **no search term**, and it returns 15 per
page. The Menu page has a free-text search and shows all rows at once.

Same two options: add `search` + pagination UI, or `per_page=100` + client filter.

### `POST /api/admin/menu-items` — `slug` is required
```php
// backend/app/Http/Controllers/MenuItemController.php:40
'slug' => ['required', 'string', 'max:180', 'unique:menu_items,slug'],
```
The create/edit form has no slug input. Either add the field, slugify client-side,
or have the backend derive it. Same for categories
(`CategoryController.php:39`).

### `orders.order_number` has no generator
The migration declares `varchar(30) UNIQUE` and nothing more
(`database/migrations/2026_09_15_000012_create_orders_table.php:14`). No
generator exists anywhere. The fixtures use the mobile app's `JAL-2300NN`
pattern — decide whether the backend keeps that format.

### `users.name` width mismatch
```php
// database/migrations/…_000001_create_users_table.php:14
$table->string('name', 150);
// but RegisterRequest / UpdateProfileRequest / StoreUserRequest all say:
'name' => ['required', 'string', 'max:255', 'min:2'],
```
Laravel will validate 200 characters and then Postgres will reject or truncate.
Widen the column or tighten the rules. See also [`ACCOUNT_LIFECYCLE.md`](./ACCOUNT_LIFECYCLE.md).

### `name` is a single field — do not split it
There is **no** `first_name` / `last_name` column anywhere in the backend. All
forms collect one "Full name" input and send one `name` value. A first/last split
was tried and deliberately reverted to keep the forms aligned with the schema.

Consequence worth knowing: you cannot sort or search users by surname, and
"greeting by first name" is only a heuristic because `name` is a free string.

### `PUT /api/admin/store-setting` requires `store_name`
`store_name` is `required` (`StoreSettingController.php:24`) — easy to 422 if you
build the payload from only the fields the form visibly changed. Already handled
in `AdminSettingsPage`; noted so it isn't reintroduced.

`store_settings` is a **singleton** — no `store_id`, no `branch_id`, and zero
occurrences of `branch`/`tenant` anywhere in the backend. `StoreSettingController`
uses `StoreSetting::first()`. So `store_name` is simply the display label the
customer app shows in its header; there is exactly one store.

⚠️ Mobile currently hardcodes this instead of reading it:
`mobile/src/app/(tabs)/menu.tsx:114` (`"SM Lanang Premier"`) and
`mobile/src/app/rider/deliveries.tsx:24` (`JALIKUD — SM Lanang Premier`). Those
should come from `GET /store-setting`.

Also: `opening_time` / `closing_time` use `date_format:H:i` (`:31-32`), so send
`"08:00"`, never `"08:00:00"`.

---

## 5. Known backend bugs to fix during integration

**`staff` cannot update order status.** `OrderController@updateStatus`
(`backend/app/Http/Controllers/OrderController.php:167`) correctly checks
`$request->user()->isStaff()` — and `User::isStaff()` returns true for both
`admin` and `staff`. But the route is registered inside the `EnsureAdmin` group:

```php
// backend/routes/api.php:60
Route::middleware(EnsureAdmin::class)      // rejects role !== 'admin'
    ->prefix('admin')
    ->group(function () {
        Route::put('/orders/{order}/status', [OrderController::class, 'updateStatus']);
```

`EnsureAdmin` (`app/Http/Middleware/EnsureAdmin.php:18`) returns 403 before the
`isStaff()` branch is ever reached, so that check is dead code for `staff`.

Fix: add an `EnsureStaff` (or `EnsureRole`) middleware and move the order-status
route out of the admin group. Note `bootstrap/app.php` registers **no** middleware
aliases at all, so the alias has to be added there too.

**`isRider()` is never called** anywhere in the backend, so `rider` accounts have
no capability distinction from `customer` beyond the customer cart/order routes.

---

## 6. Conventions to preserve when wiring

- **Money is a string.** `decimal(10,2)` and `numeric(12,2)` serialise as
  strings (`"199.00"`), never numbers. Every mock uses strings. Formatting goes
  through `peso()` in `src/mock/index.ts` — move it to a utils module on integration.
- **Timestamps are ISO 8601 with offset.** Formatted by `formatDateTime()` /
  `formatDate()` in `src/mock/index.ts`.
- **Laravel paginator envelope** is `{ data: [...], meta: { current_page,
  last_page, per_page, total } }`. `paginate()` in `src/mock/users.ts` reproduces it.
- **Role values** are `customer | staff | admin | rider`, enforced by a Postgres
  CHECK constraint on `users.role`.
- **`order_type`** is `delivery | pickup`; **`payment_status`** is
  `unpaid | paid | refunded | failed`; **`status`** is the 7-value list above.
  All three are CHECK-constrained on the backend.
- Login and register are rate-limited `throttle:5,1` — five attempts per minute.
- Bad credentials return **422**, not 401 (`AuthController` throws a
  `ValidationException` on the `email` field).
- `PUT /admin/users/{id}` refuses to change your own role.

---

## 7. A note on how this repo got here

`mobile/src/app/` contains six comments reading *"Static … will be replaced by
the backend API later"* — and to this day has **zero** `fetch`, `axios` or
`AsyncStorage` calls anywhere. Static-first quietly became static-forever
because nobody wrote down what the swap was supposed to be.

That is the only reason this file exists. Keep it updated as you wire things up,
or the same thing will happen here.

---

## 8. See also

- [`ACCOUNT_LIFECYCLE.md`](./ACCOUNT_LIFECYCLE.md) — who can create an account
  with which role, plus three gaps in the current logic (mass-assignable `role`,
  missing `rider_profiles` row, unused `isRider()`)
