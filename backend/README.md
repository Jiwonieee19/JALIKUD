# JALIKUD Backend (Laravel REST API)

JALIKUD is a food-ordering platform. This Laravel 13 API powers the React web
client — customers browse the catalog, build a cart, place delivery/pickup
orders, and apply coupons; staff/admins manage catalog, coupons, settings,
orders, and users.

Base URL (local): `http://localhost:8000` — every endpoint below is prefixed
with `/api`. So `POST /register` means `POST http://localhost:8000/api/register`.

- [1. Tech & requirements](#1-tech--requirements)
- [2. Setup](#2-setup)
- [3. Auth & roles](#3-auth--roles)
- [4. Conventions](#4-conventions-read-this-first)
- [5. Endpoint reference](#5-endpoint-reference)
  - [5.1 Auth](#51-auth-public--self)
  - [5.2 Public catalog](#52-public-catalog--store-info-no-auth)
  - [5.3 Cart](#53-cart-authenticated)
  - [5.4 Orders](#54-orders-authenticated)
  - [5.5 Admin users](#55-admin--users-admin-only)
  - [5.6 Admin catalog](#56-admin--categories--menu-items-admin-only)
  - [5.7 Admin coupons](#57-admin--coupons-admin-only)
  - [5.8 Admin settings & orders](#58-admin--store-setting--order-management)
- [6. Usage examples](#6-usage-examples-curl)
- [7. Validation cheat sheet](#7-validation-rules-cheat-sheet)
- [8. Known limitations](#8-known-limitations--not-yet-implemented)

## 1. Tech & requirements

| Piece | Details |
|---|---|
| Framework | Laravel 13, PHP `^8.3` (developed on 8.4) |
| Auth | Laravel Sanctum 4 bearer tokens, 7-day expiry (`config/sanctum.php`) |
| Database | PostgreSQL 17 in Docker/prod; SQLite works for local dev & tests |
| Routes file | `routes/api.php` — single source of truth (40 routes) |
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
auto-migrates on boot. The seeder creates one open `store_settings` row
(`JALIKUD`, delivery + pickup, 08:00–22:00) if empty. It creates **no users** —
register, then promote one:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## 3. Auth & roles

1. `POST /api/register` or `POST /api/login` returns `{ message, user, token }`.
2. Send `Authorization: Bearer <token>` on every protected call.
3. `POST /api/logout` revokes only the current token. Tokens live 7 days.

**Rate limits** — register/login are throttled to 5 reqs/min per IP
(`throttle:5,1`); exceeding returns `429`.

**Roles** — `users.role` is `customer | staff | admin | rider` (Postgres CHECK
constraint + request validation).

| Role | Capabilities |
|---|---|
| `customer` (default) | Own profile, cart, orders |
| `rider` | Same as customer today (no rider-only endpoints yet) |
| `staff` | Same as customer; status-change code allows staff (but §8: route is admin-gated) |
| `admin` | + user mgmt, catalog/coupon/setting CRUD, read all orders |

Admin routes sit behind `auth:sanctum` + `EnsureAdmin`; non-admins get
`403 { "message": "Forbidden. Administrator access required." }`.
- Errors: validation → `422 { message, errors: { field: […] } }`;
  unauthenticated → `401`; forbidden → `403 { message }`; missing model → `404`.
- Pagination (every list): `?page=` (≥ 1), `?per_page=` (1–100, default 15;
  order lists default 10). Invalid values → `422`.
- Money fields (`base_price`, `subtotal`, totals, coupon `value`, …) are
  `decimal(10,2)` and serialize as **strings** (`"129.00"`) — parse accordingly.
- Route-model binding (`{category}`, `{menuItem}`, `{coupon}`, `{user}`,
  `{order}`, `{cart}`, `{cartItem}`) binds by id. Mismatched cart↔item pairs on
  cart-item update/delete return `403`, not `404`.
- Timestamps are ISO-8601 with timezone.


## 4. Conventions (read this first)

- Headers: `Authorization: Bearer <token>`, `Accept: application/json`,
  `Content-Type: application/json`.
- Envelopes: single resource → `{ message?, data? | user? }`; deletes →
  `{ message }`; catalog/coupon/customer-order lists → default Laravel paginator
  (`{ data, links, current_page… }`); admin user list → custom
  `{ data: [...], meta: { current_page, last_page, per_page, total } }`.

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
`password` + `password_confirmation` (strong + confirmed). All required.

**`POST /api/logout`** — auth. Revokes current token.
Returns `{ message: "Logged out successfully." }`.

### 5.2 Public catalog & store info (no auth)

Lists accept `?page=&per_page=` (default 15, max 100).

**`GET /api/store-setting`** — returns `{ data: { store_name, is_open,
accepts_delivery, accepts_pickup, min_order_amount, delivery_fee,
### 5.3 Cart (authenticated)

One cart per user, auto-created on first use (`order_type` defaults to
`delivery`). Responses embed `cartItems.menuItem`,
`cartItems.options.variantOption`, plus `address`/`coupon` where loaded.

**`GET /api/cart`** — returns `{ data: cart }`, creating an empty cart if needed.

**`POST /api/cart/items`** → `201`. Fields: `menu_item_id` (required, must
exist), `quantity` (required, int ≥ 1), `notes` (optional, ≤ 500 chars),
`options` (optional array of `{ variant_option_id }`, each must exist).
`unit_price` is snapshotted from `base_price`; options are stored with
`price_delta: 0` (variants recorded but **not priced** — see §8).

**`PUT /api/cart/items/{cart}/{cartItem}`** — body `{ quantity?: int ≥ 1,
notes?: string ≤ 500 | null }`. `403` if the cart isn't yours or the item isn't
in that cart.

**`DELETE /api/cart/items/{cart}/{cartItem}`** — same ownership rule.
`200 { message: "Item removed from cart." }`.

**`DELETE /api/cart`** — deletes all lines, clears `address_id` + `coupon_id`
(cart row stays). `200 { message: "Cart cleared." }`.

**`POST /api/cart/coupon`** — body `{ code }` (required, ≤ 50). Attaches an
*active* coupon by code. Unknown/inactive → `422`
`{ message: "Coupon code not found or inactive." }` (plain message, no `errors`
object). No expiry/minimum/usage checks at this step.

### 5.4 Orders (authenticated)

**`GET /api/orders`** — paginated (default 10/page). Customers see only their
orders; **admins see all** (`isAdmin()` branch). Staff/riders see only their own.

**`GET /api/orders/{order}`** — detail with `user, address, rider, coupon,
orderItems.options, statusHistory, payments, reviews`. Owner or admin only,
else `403 { message: "Forbidden." }`.

**`POST /api/orders`** → `201`. Checkout: snapshots the cart into an order, then
empties it. Empty cart → `422 { message: "Your cart is empty." }`. Fields:
`order_type` (required: `delivery|pickup`), `address_id` (optional, must exist;
omit/`null` for pickup), `coupon_code` (optional ≤ 50 — unknown/inactive codes
are **silently ignored**: no error, no discount), `notes` (optional ≤ 2000 chars),
`scheduled_for` (optional date; `null` = ASAP). Server-side totals:

```text
discount     = fixed → min(coupon.value, subtotal)
               percent → min(value% of subtotal, max_discount_amount or subtotal)
delivery_fee = delivery ? store_settings.delivery_fee : 0
tax          = subtotal × tax_rate_percent / 100   (on pre-discount subtotal)
total        = subtotal − discount + delivery_fee + tax
```
### 5.5 Admin — users (admin only)

`role` accepts `customer | staff | admin | rider` everywhere.

**`GET /api/admin/users?search=&page=&per_page=`** — search matches name/email
(`LIKE %…%`), newest first. Custom envelope:
`{ data: [{ id, name, email, phone, role, created_at, deleted_at }], meta: {…} }`.

**`POST /api/admin/users`** → `201`. `name`/`email` as register (email unique),
`phone` optional ≤ 30, `password` required strong (**no** confirmation needed),
`role` optional (defaults `customer`). Returns `{ message, data }`.

**`GET /api/admin/users/{user}`** → `{ data }`.

**`PUT|PATCH /api/admin/users/{user}`** — `name`/`email` required; `password`
optional (omit/`null` keeps); `phone` optional; `role` optional. Changing your
**own** role → `422 { errors: { role: ["You cannot change your own role."] } }`.

**`DELETE /api/admin/users/{user}`** — soft-delete. Self-delete → `422`
`{ errors: { user: ["You cannot delete your own account."] } }`, else
`200 { message: "User <email> deleted." }`.

### 5.6 Admin — categories & menu items (admin only)

Categories: `POST /api/admin/categories`, `PUT|PATCH
/api/admin/categories/{category}`, `DELETE /api/admin/categories/{category}`.
Menu items mirror under `/api/admin/menu-items` (plural, hyphenated;
binding `{menu_item}`).

Category create: `name` required ≤ 100, `slug` required ≤ 120 unique,
`parent_id` nullable must exist, `description`/`image_url` nullable strings,
`sort_order` nullable int ≥ 0, `is_active` boolean. Update: same but `sometimes`
(slug unique except self). Delete → `{ message: "Category deleted." }`.
No guard against self-parenting; deleting a parent orphans children
(`parent_id → null`) — see §8.

Menu-item create: `category_id` required must exist, `name` ≤ 150, `slug` ≤ 180
unique, `sku` nullable ≤ 50 unique, `base_price` required numeric ≥ 0,
`is_available`/`is_featured` booleans, `preparation_time_minutes`/`calories`
nullable ints ≥ 0. Update: `sometimes` variants. No variant-group endpoints —
groups/options are read-only via `GET /api/menu*` includes (manage in DB).

### 5.7 Admin — coupons (admin only)

Full resource except `create`/`edit`:
`GET|POST /api/admin/coupons`, `GET|PUT|PATCH|DELETE /api/admin/coupons/{coupon}`.
Fields: `code` required ≤ 50 unique (except self); `type` required
`fixed|percentage` (`value` = currency units or percent number); `value` required
≥ 0; `min_order_amount`/`max_discount_amount` optional ≥ 0;
`usage_limit`/`usage_limit_per_user` optional int ≥ 1; `starts_at`/`expires_at`
optional dates (`expires_at` after `starts_at` when both sent); `is_active`
boolean. List supports `?active=true`. Limits/windows are stored but **not
enforced** at cart/checkout — see §8.

### 5.8 Admin — store setting & order management

**`PUT /api/admin/store-setting`** — admin upsert (creates row if missing):
`store_name` required ≤ 150; `is_open`/`accepts_delivery`/`accepts_pickup`
booleans; `min_order_amount`/`delivery_fee`/`tax_rate_percent` optional ≥ 0
(`min_order_amount` stored but not enforced); `opening_time`/`closing_time`
optional `H:i` (`"08:00"`).

**`GET /api/admin/orders` · `GET /api/admin/orders/{order}`** — same handlers as
customer routes but unscoped: admins see every order. (Staff/riders get `403`
from `EnsureAdmin` on these paths.)

**`PUT /api/admin/orders/{order}/status`** — staff-or-admin *in code*
(`isStaff()`), but the route lives under the admin-only group so **staff get
`403` before reaching it** (see §8). Fields: `status` (required, one of
`pending, confirmed, preparing, ready, out_for_delivery, completed, cancelled`),
`note` (optional ≤ 500, stored in `order_status_history`). Appends a history row
(`status`, `changed_by` = you). No transition validation — any → any.


Created as `status: pending`, `payment_status: unpaid`,
`order_number: ORD-YYYYMMDD-XXXX`, with a `pending` row in
`order_status_history` and a `coupon_redemptions` row when a valid coupon applied.

tax_rate_percent, opening_time, closing_time, updated_at } | null }`.
`data` is `null` when no row seeded — clients must handle it.

**`GET /api/categories` / `GET /api/categories/{category}`** — list supports
`?active=true`, ordered by `sort_order`, each with `children`; detail loads
`children` + `menuItems`.

**`GET /api/menu` / `GET /api/menu/{menuItem}`** — list filters:
`?category_id=`, `?available=true`, `?featured=true`; ordered by name; each item
includes `category` + `variantGroups.options`. Detail loads the same relations.

An admin cannot change their own role or delete their own account.


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

# Admin (log in as an admin for $ADMIN_TOKEN first)
curl -s "$BASE/admin/users?per_page=5" -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Accept: application/json'

curl -s -X PUT $BASE/admin/orders/9/status -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"status":"confirmed","note":"Kitchen acknowledged"}'
```

The React client (`frontend/src/services/api.ts`, Axios + `localStorage` token)
and the `postman/` collection mirror this flow.

## 7. Validation rules cheat sheet

| Input | Rule (source) |
|---|---|
| Passwords (register, password change, admin create/update) | `StrongPassword`: ≥ 8 chars, ≥ 1 lowercase, ≥ 1 UPPERCASE, ≥ 1 digit; special **not** required. Register/password-change also require `password_confirmation`. |
| Phone (register, admin create/update) | Optional string ≤ 30 — **format not checked**. (`App\Rules\PhoneNumber` exists but is wired into no request.) |
| Roles | `customer, staff, admin, rider` wherever a role is accepted (register excludes role). |
| Order type | `delivery, pickup`. |
| Order status | `pending, confirmed, preparing, ready, out_for_delivery, completed, cancelled`. |
| Payment status | `unpaid, paid, refunded, failed` (DB-level; no endpoint writes it yet). |
| Coupon type | `fixed, percentage`. |
| Pagination | `page` ≥ 1 int; `per_page` 1–100 int, else `422`. |
| Slugs/codes | Category `slug` ≤ 120 unique; menu `slug` ≤ 180 + `sku` ≤ 50 unique; coupon `code` ≤ 50 unique. |
| Times | Store hours `H:i` (`"08:00"`); `expires_at` after `starts_at` when both sent. |

## 8. Known limitations / not yet implemented

So clients don't rely on behavior that doesn't exist:

1. **No address / rider / review / payment / variant endpoints.** Those tables and
   models exist, but no API writes them except as cart/checkout side effects
   (checkout accepts an existing `address_id`; it cannot create one — seed
   addresses in DB directly).
2. **Cart variant options are priced at zero.** `addItem` always writes
   `price_delta: 0` and checkout ignores option deltas.
3. **Coupon enforcement is partial.** Expiry, global/per-user usage limits, and
   cart-time minimums are not checked; unknown checkout codes are silently
   ignored; `used_count` is never incremented though redemptions are recorded.
4. **Staff role is half-wired.** `updateStatus()` allows staff, but the route is
   inside the admin-only group, so staff get `403` before reaching it.
5. **Checkout assumes store settings exist.** With no `store_settings` row (fresh
   DB, seeder skipped), `POST /api/orders` throws a 500 on `->delivery_fee` of
   null. Keep the seeder row or create settings via the admin API first.
6. **Tax is on the pre-discount subtotal** (`subtotal × rate`), not `(subtotal −
   discount) × rate`.
7. **Category tree is unguarded.** Self-parenting allowed; deleting a parent
   orphans children; deleting a category with items orphans the items.
8. **No customer cancel endpoint** — cancellation only via the admin status route.
9. **Payments are read-only.** `payments` appear in order detail, but no endpoint
   creates/charges/refunds them; `payment_status` never leaves `unpaid` via API.
10. **Admin user JSON** omits `email_verified_at`/`updated_at`; delete returns a
    plain message with no `data`.


