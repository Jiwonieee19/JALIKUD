# JALIKUD Backend (Laravel REST API)

JALIKUD is a food-ordering platform. This Laravel 13 API powers the React web
client and the Expo mobile app — customers browse the catalog, build a cart,
place delivery/pickup orders, apply coupons, redeem loyalty rewards, and review
completed orders; staff/admins run the order queue and manage the catalog,
variants, coupons, settings, and users; riders work their own delivery queue.

Base URL (local): `http://localhost:8000` — every endpoint below is prefixed
with `/api`. So `POST /register` means `POST http://localhost:8000/api/register`.

- [1. Tech & requirements](#1-tech--requirements)
- [2. Setup](#2-setup)
- [3. Auth & roles](#3-auth--roles)
- [4. Conventions](#4-conventions-read-this-first)
- [5. Endpoint reference](#5-endpoint-reference)
  - [5.1 Auth](#51-auth-public--self)
  - [5.2 Public catalog & store info](#52-public-catalog--store-info-no-auth)
  - [5.3 Cart](#53-cart-authenticated)
  - [5.4 Orders](#54-orders-authenticated)
  - [5.5 Reviews](#55-reviews-authenticated--public)
  - [5.6 Rider](#56-rider-rider-only)
  - [5.7 Admin users](#57-admin--users-admin-only)
  - [5.8 Admin catalog](#58-admin--categories--menu-items--variants-admin-only)
  - [5.9 Admin coupons](#59-admin--coupons-admin-only)
  - [5.10 Admin orders & payments](#510-admin--orders--payments-staffadmin)
  - [5.11 Admin store setting, stats & uploads](#511-admin--store-setting-stats--uploads-admin-only)
- [6. Usage examples](#6-usage-examples-curl)
- [7. Validation cheat sheet](#7-validation-rules-cheat-sheet)
- [8. Known limitations](#8-known-limitations--not-yet-implemented)

## 1. Tech & requirements

| Piece | Details |
|---|---|
| Framework | Laravel 13, PHP `^8.3` (developed on 8.4) |
| Auth | Laravel Sanctum 4 bearer tokens, 7-day expiry (`config/sanctum.php`) |
| Database | PostgreSQL 17 in Docker/prod; SQLite works for local dev & tests |
| Routes file | `routes/api.php` — single source of truth (77 routes) |
| Tests | PHPUnit; `phpunit.xml` uses in-memory SQLite |

Verify the route table any time with `php artisan route:list --path=api`.

## 2. Setup

```powershell
cd backend
cp .env.example .env        # then set DB_* / APP_KEY / APP_URL
composer install
php artisan key:generate
php artisan migrate         # or: php artisan migrate:fresh --seed
php artisan serve           # http://localhost:8000
```

Docker for the whole stack is in the **root** `README.md`; the backend container
auto-migrates on boot. `php artisan migrate:fresh --seed` runs:

- `UserSeeder` — five demo accounts: `admin@jalikud.test`, `staff@jalikud.test`,
  `rider@jalikud.test` (with a `rider_profiles` row), `customer@jalikud.test`
  (with a default address) and `customer2@jalikud.test`, all with password
  `Jalikud123` (override with `SEED_USER_PASSWORD`).
- One open `store_settings` row (`JALIKUD`, delivery + pickup, 08:00–22:00) if
  the table is empty.
- `MenuSeeder` — seeds the real 4-category / 10-item catalog and purges rows the
  Postman collection generates (`Postman Cat …` / `Postman Meal t-*`). It is
  idempotent, so it can be re-run against a live database at any time:

  ```bash
  php artisan db:seed --class=MenuSeeder
  ```
- `RewardSeeder` — seeds the loyalty catalogue (`chickenjoy-1pc`, `yumburger`,
  `voucher-100`) from `config/rewards.php` into the `rewards` table, matching
  free-item rewards to their menu items by slug. Idempotent.

On databases seeded before `UserSeeder` existed, promote an account by hand:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## 3. Auth & roles

1. `POST /api/register` or `POST /api/login` returns `{ message, user, token }`.
2. Send `Authorization: Bearer <token>` on every protected call.
3. `POST /api/logout` revokes only the current token. Tokens live 7 days.

**Rate limits** — register/login are throttled to 5 reqs/min per IP
(`throttle:5,1`); order placement (`throttle:orders`, 10/min), coupon apply
(`throttle:coupons`, 6/min), and password change (`throttle:password`, 5/min)
are also capped. Exceeding returns `429`.

**Roles** — `users.role` is `customer | staff | admin | rider` (Postgres CHECK
constraint + request validation). The role lives on the user row and is resolved
server-side from the bearer token; tokens themselves carry no role/scope.

| Role | Capabilities |
|---|---|
| `customer` (default) | Own profile, addresses, cart, orders, reviews, loyalty (rewards/points) |
| `rider` | Own delivery queue, profile and duty availability (`EnsureRider`) |
| `staff` | Order queue: list orders, advance status, confirm payment, assign riders, toggle menu availability, list riders (`EnsureStaff` = staff **or** admin) |
| `admin` | Everything above, plus user management, full catalog (categories/menu/variants), coupons, store settings, reviews moderation, stats, uploads (`EnsureAdmin`) |

Role middleware errors:

- `EnsureAdmin` → `403 { "message": "Forbidden. Administrator access required." }`
- `EnsureStaff` → `403 { "message": "Forbidden. Staff access required." }`
- `EnsureRider` → `403 { "message": "Forbidden. Rider access required." }`

- Errors: validation → `422 { message, errors: { field: […] } }`;
  unauthenticated → `401`; forbidden → `403 { message }`; missing model → `404`.
- Pagination (every list): `?page=` (≥ 1), `?per_page=` (1–100, default 15;
  order lists default 10). Invalid values → `422`.
- Money fields (`base_price`, `subtotal`, totals, coupon `value`, `price_delta`,
  …) are `decimal(10,2)` and serialize as **strings** (`"129.00"`) — parse
  accordingly.
- Route-model binding (`{category}`, `{menuItem}`, `{coupon}`, `{user}`,
  `{order}`, `{cart}`, `{cartItem}`, `{variantGroup}`, `{variantOption}`,
  `{review}`, `{payment}`) binds by id. Mismatched cart↔item pairs on cart-item
  update/delete return `403`, not `404`.
- Timestamps are ISO-8601 with timezone.

## 4. Conventions (read this first)

- Headers: `Authorization: Bearer <token>`, `Accept: application/json`,
  `Content-Type: application/json`.
- Envelopes: single resource → `{ message?, data? | user? }`; deletes →
  `{ message }`; catalog/coupon/order/review lists → default Laravel paginator
  (`{ data, links, current_page… }`); admin user list → custom
  `{ data: [...], meta: { current_page, last_page, per_page, total } }`;
  admin stats → `{ data: { … } }`.

## 5. Endpoint reference

### 5.1 Auth (public + self)

**`POST /api/register`** — public, throttled. Creates a `customer` account.
`role` is not accepted here. Fields: `name` (required, 2–255 chars), `email`
(required, email, unique), `phone` (optional, string ≤ 30, format not checked),
`password` (required, `confirmed` — send matching `password_confirmation`;
strong: ≥ 8 chars + lowercase + UPPERCASE + digit). `201` → `{ message, user, token }`.

**`POST /api/login`** — public, throttled. Fields: `email`, `password`
(both required). `200` → `{ message, user, token }`. Bad credentials → `422`
`{ errors: { email: ["The provided credentials are incorrect."] } }`.

**`GET /api/user`** — auth. Returns `{ user }` for the token owner.

**`PUT /api/profile`** — auth. Update own name/email; both required, email
unique except self. Returns `{ message, user }`.

**`PUT /api/password`** — auth. Fields: `current_password` (must match),
`password` + `password_confirmation` (strong + confirmed). All required. Revokes
every other token.

**`POST /api/logout`** — auth. Revokes current token.
Returns `{ message: "Logged out successfully." }`.

### 5.2 Public catalog & store info (no auth)

**`GET /api/store-setting`** — returns `{ data: { store_name, is_open,
accepts_delivery, accepts_pickup, min_order_amount, delivery_fee,
tax_rate_percent, opening_time, closing_time, updated_at } | null }`.
`data` is `null` when no row is seeded — clients must handle it.

**`GET /api/categories` / `GET /api/categories/{category}`** — list supports
`?active=true`, ordered by `sort_order`, each with `children`; detail loads
`children` + `menuItems`.

**`GET /api/menu` / `GET /api/menu/{menuItem}`** — list filters:
`?category_id=`, `?available=true`, `?featured=true`, `?search=` (matches
name/description, case-insensitive); ordered by name; each item includes
`category` + `variantGroups.options`. Detail loads the same relations.

**`GET /api/menu/{menuItem}/reviews`** — public rating summary for an item:
`{ data: { average, count, reviews: [...] } }`.


### 5.3 Cart (authenticated)

One cart per user, auto-created on first use (`order_type` defaults to
`delivery`). Responses embed `cartItems.menuItem`,
`cartItems.options.variantOption`, plus `address`/`coupon` where loaded.

**Every cart endpoint returns the same authoritative representation** (`GET`,
item create/update/delete, clear, coupon apply, reward apply/remove), so clients
can render totals from any response without a follow-up fetch:

```json
{
  "data": {
    "id": 1,
    "cart_items": [
      {
        "id": 5,
        "menu_item_id": 8,
        "quantity": 2,
        "unit_price": "120.00",
        "line_total": "300.00",
        "menu_item": { "...": "..." },
        "options": [{ "...": "...", "price_delta": "30.00" }]
      }
    ],
    "address": null,
    "coupon": null,
    "subtotal": "300.00",
    "discount_amount": "0.00",
    "delivery_fee": "50.00",
    "tax_amount": "36.00",
    "total_amount": "386.00",
    "pricing_errors": []
  }
}
```

Money values are two-decimal strings. Lines are re-priced from the live catalog
on every response, so stale snapshots never override current prices:

```text
line_total      = (live base_price + live option deltas) × quantity
subtotal        = Σ line totals
discount_amount = attached coupon discount (0 when invalid/expired)
delivery_fee    = store delivery fee when order_type=delivery, else 0
tax_amount      = subtotal × tax_rate_percent / 100
total_amount    = subtotal − discount + delivery fee + tax
pricing_errors  = unavailable-item / invalid-coupon messages (fail-closed)
```

**`GET /api/cart`** — returns `{ data: cart }`, creating an empty cart if needed.

**`POST /api/cart/items`** → `201`. Fields: `menu_item_id` (required, must
exist), `quantity` (required, int ≥ 1), `notes` (optional, ≤ 500 chars),
`options` (optional array of `{ variant_option_id }`, each must exist and be
selectable for that item — required/min/max group rules are enforced). Option
rows snapshot their real `price_delta`, but pricing always re-reads the live
option value.

**`PUT /api/cart/items/{cart}/{cartItem}`** — body `{ quantity?: int ≥ 1,
notes?: string ≤ 500 | null }`. `403` if the cart isn't yours or the item isn't
in that cart.

**`DELETE /api/cart/items/{cart}/{cartItem}`** — same ownership rule. `200`
with the refreshed cart payload.

**`DELETE /api/cart`** — deletes all lines, clears `address_id` + `coupon_id`
(cart row stays). `200` with the refreshed (empty) cart payload.

**`POST /api/cart/coupon`** — body `{ code }` (required, ≤ 50). Attaches an
*active* coupon by code after checking it against the authoritative cart
subtotal (window, usage limits, and minimum are enforced at attach time).
Unknown/inactive/rejected → `422 { message: "…" }`. Success returns the
refreshed cart payload.

**`POST /api/cart/reward`** — body `{ reward_key }`. Reserves a loyalty reward
on the cart (points are deducted only at checkout). `DELETE /api/cart/reward`
clears it.


### 5.4 Orders (authenticated)

**`GET /api/orders`** — paginated (default 10/page). Customers see only their
orders; **staff/admins see all**. Each order embeds `address` (no coordinates)
and `order_items` (`item_name`, `quantity`, `subtotal`). The `user` object is
never included in the customer index.

**`GET /api/orders/{order}`** — detail with `user, address, rider, coupon,
orderItems.options, statusHistory, payments, reviews`. Owner or staff/admin,
else `403 { message: "Forbidden." }`.

**`POST /api/orders`** → `201`. Checkout: snapshots the cart into an order, then
empties it. Empty cart → `422 { message: "Your cart is empty." }`. Fields:
`order_type` (required: `delivery|pickup`), `address_id` (optional, must be
owned by you; omit/`null` for pickup), `coupon_code` (optional ≤ 50 — rejected
codes fail closed; when omitted, the cart's attached coupon is used), `notes`
(optional ≤ 2000 chars), `scheduled_for` (optional date; `null` = ASAP),
`payment_method` (optional `cod|gcash`, default `cod`). Server-side totals:

```text
discount     = fixed → min(coupon.value, subtotal)
               percent → min(value% of subtotal, max_discount_amount or subtotal)
delivery_fee = delivery ? store_settings.delivery_fee : 0
tax          = subtotal × tax_rate_percent / 100   (on pre-discount subtotal)
total        = subtotal − discount + delivery_fee + tax
```

Created as `status: pending`, `payment_status: unpaid`,
`order_number: ORD-YYYYMMDD-XXXX`, with a `pending` row in
`order_status_history` and a `coupon_redemptions` row when a valid coupon is
applied.

**`POST /api/orders/{order}/cancel`** — customer cancels their **own** order
while it is still `pending`/`confirmed` (before the kitchen starts). Refunds any
loyalty points spent on a reward. `403` for someone else's order, `422` once the
order has progressed past `confirmed`.

### 5.5 Reviews (authenticated + public)

**`POST /api/orders/{order}/review`** — customer reviews their own **completed**
order. Fields: `rating` (required, int 1–5), `comment` (optional ≤ 1000),
`menu_item_id` (optional — must be an item actually in the order; omit for an
order-level review). One review per (order, user, item) — a repeat returns `422`.
`201` → `{ data: review }`.

**`GET /api/menu/{menuItem}/reviews`** — public, see §5.2.

**`GET /api/admin/reviews`** — admin moderation list (paginated, with
`user`/`menuItem`). **`DELETE /api/admin/reviews/{review}`** — remove a review.


### 5.6 Rider (rider only)

All routes require the `rider` role (`EnsureRider`).

**`GET /api/rider/deliveries`** — the authenticated rider's own queue
(`rider_id = me`), paginated, newest first, with `user`, `address` and
`orderItems`.

**`GET /api/rider/deliveries/{order}`** — detail for an order assigned to me
(`404` for anyone else's order).

**`PUT /api/rider/deliveries/{order}/status`** — advance only the delivery leg:
`ready → out_for_delivery → completed`. Kitchen states are refused (`422`).
Completing an order awards loyalty points.

**`PUT /api/rider/availability`** — body `{ is_available: bool }`. Toggles the
rider's duty status (staff can only assign on-duty riders).

**`GET /api/rider/profile`** — the rider's own profile (creates an inactive one
if missing). **`PUT /api/rider/profile`** — edit `photo_url`,
`vehicle_type` (`motorcycle|bicycle|car`), `plate_number`.

### 5.7 Admin — users (admin only)

`role` accepts `customer | staff | admin | rider` everywhere.

**`GET /api/admin/users?search=&page=&per_page=`** — search matches name/email
(`LIKE %…%`), newest first. Custom envelope:
`{ data: [{ id, name, email, phone, role, created_at, deleted_at }], meta: {…} }`.

**`POST /api/admin/users`** → `201`. `name`/`email` as register (email unique),
`phone` optional ≤ 30, `password` required strong (**no** confirmation needed),
`role` optional (defaults `customer`). Creating a `rider` auto-creates a
`rider_profiles` row (on duty by default). Returns `{ message, data }`.

**`GET /api/admin/users/{user}`** → `{ data }`.

**`PUT|PATCH /api/admin/users/{user}`** — `name`/`email` required; `password`
optional (omit/`null` keeps); `phone` optional; `role` optional. Changing your
**own** role → `422 { errors: { role: ["You cannot change your own role."] } }`.

**`DELETE /api/admin/users/{user}`** — soft-delete. Self-delete → `422`
`{ errors: { user: ["You cannot delete your own account."] } }`, else
`200 { message: "User <email> deleted." }`.


### 5.8 Admin — categories, menu items & variants (admin only)

**Categories** — `POST /api/admin/categories`, `PUT|PATCH
/api/admin/categories/{category}`, `DELETE /api/admin/categories/{category}`.
Create: `name` required ≤ 100, `slug` required ≤ 120 unique, `parent_id`
nullable must exist, `description`/`image_url` nullable strings, `sort_order`
nullable int ≥ 0, `is_active` boolean. Update: same but `sometimes` (slug unique
except self). A category **cannot be its own parent**, and deleting a category
that still has children or menu items returns `422`.

**Menu items** — `POST /api/admin/menu-items` (create), `PUT|PATCH
/api/admin/menu-items/{menuItem}` (update — also available to staff for
availability toggling), `DELETE /api/admin/menu-items/{menuItem}` (soft-delete).
Create: `category_id` required must exist, `name` ≤ 150, `slug` ≤ 180 unique,
`sku` nullable ≤ 50 unique, `base_price` required numeric ≥ 0,
`is_available`/`is_featured` booleans, `preparation_time_minutes`/`calories`
nullable ints ≥ 0. Update: `sometimes` variants.

**Variants** (admin only):

- `GET /api/admin/menu-items/{menuItem}/variant-groups` — list groups (with
  `options`) for an item.
- `POST /api/admin/menu-items/{menuItem}/variant-groups` — create a group:
  `name` required ≤ 100, `selection_type` (`single|multiple`), `is_required`
  boolean, `min_select`/`max_select` ints ≥ 0, `sort_order` int ≥ 0.
- `PUT|PATCH /api/admin/variant-groups/{variantGroup}` — update a group.
- `DELETE /api/admin/variant-groups/{variantGroup}` — delete a group (cascades
  its options).
- `POST /api/admin/variant-groups/{variantGroup}/options` — create an option:
  `name` required ≤ 100, `price_delta` numeric, `is_default`/`is_available`
  booleans, `sort_order` int ≥ 0.
- `PUT|PATCH /api/admin/variant-options/{variantOption}` / `DELETE
  /api/admin/variant-options/{variantOption}` — update/delete an option.


### 5.9 Admin — coupons (admin only)

Full resource except `create`/`edit`:
`GET|POST /api/admin/coupons`, `GET|PUT|PATCH|DELETE /api/admin/coupons/{coupon}`.
Fields: `code` required ≤ 50 unique (except self); `type` required
`fixed|percentage` (`value` = currency units or percent number); `value` required
≥ 0; `min_order_amount`/`max_discount_amount` optional ≥ 0;
`usage_limit`/`usage_limit_per_user` optional int ≥ 1; `starts_at`/`expires_at`
optional dates (`expires_at` after `starts_at` when both sent); `is_active`
boolean. List supports `?active=true`. Validity window, usage limits and minimum
are **enforced** at cart attach and checkout.

**`GET /api/admin/coupons/{coupon}/redemptions`** — who redeemed this coupon
(paginated, with `user` + `order`).

### 5.10 Admin — orders & payments (staff/admin)

Order routes here sit behind `EnsureStaff` (staff **or** admin), so staff can run
the queue without full admin rights.

**`GET /api/admin/orders` · `GET /api/admin/orders/{order}`** — same handlers as
the customer routes but unscoped: staff/admins see every order.

**`PUT /api/admin/orders/{order}/status`** — advance an order. Fields: `status`
(required, one of the 7 values), `note` (optional ≤ 500, stored in
`order_status_history`). Transitions are enforced:
`pending → confirmed|cancelled → preparing → ready`. Staff complete pickup
orders from `ready`; only the assigned rider can move delivery orders to
`out_for_delivery` and `completed`. Completing awards points; cancelling refunds
points and demo GCash payments.

**`PUT /api/admin/orders/{order}/rider`** — assign (or unassign) a rider. Body
`{ rider_id: int|null }`. The assignee must hold the `rider` role, be on duty,
and the order must be `delivery` and not yet out for delivery/completed.

**`GET /api/admin/riders`** — list rider accounts (with `riderProfile`).
**`PUT|PATCH /api/admin/riders/{user}/profile`** — administer a rider's
`photo_url`, `vehicle_type`, `plate_number`, `is_active` (admin only).

**Payments** (staff/admin, read-only):

- `GET /api/admin/orders/{order}/payments` — list payment records for an order.
- GCash creates a succeeded demo payment at checkout. COD creates a succeeded
  payment when the assigned rider completes delivery and confirms collection.


### 5.11 Admin — store setting, stats & uploads (admin only)

**`PUT /api/admin/store-setting`** — admin upsert (creates row if missing):
`store_name` required ≤ 150; `is_open`/`accepts_delivery`/`accepts_pickup`
booleans; `min_order_amount`/`delivery_fee`/`tax_rate_percent` optional ≥ 0
(all enforced at checkout); `opening_time`/`closing_time` optional `H:i`
(`"08:00"`).

**`GET /api/admin/stats`** — dashboard summary:
`{ data: { revenue, orders_by_status, total_orders, total_customers,
total_staff, total_riders, active_riders, menu_items_available,
menu_items_total } }`. `revenue` is the sum of `total_amount` for
completed+paid orders (money string).

**`GET /api/admin/overview`** — the "today" snapshot the web dashboard renders:
`{ data: { revenue_today, orders_today, active_orders, completed_today,
cancelled_today, pending_orders, sold_out_items, menu_items_total,
riders_available, riders_on_delivery, riders_offline, store_open,
generated_at } }`. **`GET /api/admin/overview/revenue`** — a 7-day series
`{ data: [ { date, revenue, orders } ] }` (cancelled orders excluded).

**`POST /api/admin/uploads/image`** — multipart field `image` (image, jpg/png/
webp/gif ≤ 5 MB). **`POST /api/admin/uploads/document`** — field `document`
(pdf/doc/docx/xls/xlsx/csv/txt ≤ 10 MB). Both return `{ data: { url, path } }`.

### 5.12 Admin — rewards & points (admin only)

The loyalty catalogue lives in the `rewards` table (seeded by `RewardSeeder` from
`config/rewards.php`); `PointLedger::definitions()` reads it at runtime and the
customer `GET /api/rewards` excludes `is_active=false` rows.

- `GET /api/admin/rewards` — list all rewards (with `menuItem`).
- `POST /api/admin/rewards` — create. `key` (≤ 50, unique, immutable), `label`
  (≤ 120), `type` (`free_item|voucher`), `points_cost` (int ≥ 0), `is_active`.
  `free_item` requires `menu_item_id`; `voucher` requires `discount_amount` and
  optionally `min_order_amount`.
- `PUT|PATCH /api/admin/rewards/{reward}` — partial update; `key` is immutable.
- `DELETE /api/admin/rewards/{reward}` — delete; returns `409` when a cart or
  order still references the reward's `key`.
- `GET /api/admin/rewards/redemptions` — spent ledger rows joined to the order.
- `GET /api/admin/points` — the full ledger across all users.

## 6. Usage examples (cURL)

```bash
BASE=http://localhost:8000/api

# Register + capture token
TOKEN=$(curl -s -X POST $BASE/register \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","password":"Secret123","password_confirmation":"Secret123"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# Browse menu (public)
curl -s "$BASE/menu?available=true&per_page=5" -H 'Accept: application/json'

# Add to cart, attach coupon, checkout
curl -s -X POST $BASE/cart/items -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"menu_item_id":7,"quantity":2}'

curl -s -X POST $BASE/cart/coupon -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"code":"WELCOME10"}'

curl -s -X POST $BASE/orders -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"order_type":"delivery","coupon_code":"WELCOME10"}'

# Review a completed order
curl -s -X POST $BASE/orders/12/review -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"rating":5,"comment":"Great!"}'

# Rider: toggle availability and read the queue
curl -s -X PUT $BASE/rider/availability -H "Authorization: Bearer $RIDER_TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"is_available":true}'
curl -s "$BASE/rider/deliveries" -H "Authorization: Bearer $RIDER_TOKEN" -H 'Accept: application/json'

# Admin (log in as an admin for $ADMIN_TOKEN first)
curl -s "$BASE/admin/users?per_page=5" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Accept: application/json'

curl -s -X PUT $BASE/admin/orders/9/status -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"status":"confirmed","note":"Kitchen acknowledged"}'

# Admin: create a variant group + option, then stats
curl -s -X POST $BASE/admin/menu-items/7/variant-groups -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"name":"Size","selection_type":"single","is_required":true}'
curl -s "$BASE/admin/stats" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Accept: application/json'
```

The React client (`frontend/src/services/api.ts`, Axios + `localStorage` token),
the Expo app (`mobile/src/lib/*.ts`, `fetch` + `expo-secure-store` token) and the
`postman/` collection mirror this flow.


## 7. Validation rules cheat sheet

| Input | Rule (source) |
|---|---|
| Passwords (register, password change, admin create/update) | `StrongPassword`: ≥ 8 chars, ≥ 1 lowercase, ≥ 1 UPPERCASE, ≥ 1 digit; special **not** required. Register/password-change also require `password_confirmation`. |
| Phone (register, admin create/update) | Optional string ≤ 30 — **format not checked**. (`App\Rules\PhoneNumber` exists but is wired into no request.) |
| Roles | `customer, staff, admin, rider` wherever a role is accepted (register excludes role). |
| Order type | `delivery, pickup`. |
| Order status | `pending, confirmed, preparing, ready, out_for_delivery, completed, cancelled`. |
| Payment status | `unpaid, paid, refunded, failed` (order); `pending, succeeded, failed, refunded` (payment record). |
| Payment provider | `cod, gcash, stripe, paypal`. |
| Rider vehicle type | `motorcycle, bicycle, car`. |
| Review rating | int `1..5`. |
| Variant `selection_type` | `single, multiple`. |
| Coupon type | `fixed, percentage`. |
| Pagination | `page` ≥ 1 int; `per_page` 1–100 int, else `422`. |
| Slugs/codes | Category `slug` ≤ 120 unique; menu `slug` ≤ 180 + `sku` ≤ 50 unique; coupon `code` ≤ 50 unique. |
| Times | Store hours `H:i` (`"08:00"`); `expires_at` after `starts_at` when both sent. |

## 8. Known limitations / not yet implemented

1. **Tax is on the pre-discount subtotal** (`subtotal × rate`), not
   `(subtotal − discount) × rate`.
2. **GCash is demo-only.** Selecting GCash marks the order paid without a live
   gateway, webhook, or proof of transfer. Cancelling it records a demo refund.
3. **No push notifications / activity feed.** Status changes are persisted to
   `order_status_history` but do not notify customers, staff or riders in-app.
4. **Single store.** `store_settings` is a single row; there is no multi-branch
   model.
5. **Admin user JSON** omits `email_verified_at`/`updated_at`; delete returns a
   plain message with no `data`.
