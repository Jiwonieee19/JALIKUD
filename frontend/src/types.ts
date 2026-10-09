export type UserRole = 'customer' | 'staff' | 'admin' | 'rider'

export interface User {
  id: number
  name: string
  email: string
  phone: string | null
  role: UserRole
}

export interface AdminUser {
  id: number
  name: string
  email: string
  phone: string | null
  role: UserRole
  created_at: string | null
  deleted_at: string | null
}

export interface AuthResponse {
  message: string
  user: User
  token?: string
}

export interface Address {
  id: number
  user_id: number
  label: string | null
  line1: string
  line2: string | null
  city: string
  state: string | null
  postal_code: string | null
  country: string
  latitude: string | null
  longitude: string | null
  is_default: boolean
  created_at: string | null
  updated_at: string | null
}

export interface Category {
  id: number
  parent_id: number | null
  name: string
  slug: string
  description: string | null
  image_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface MenuItem {
  id: number
  category_id: number
  name: string
  slug: string
  description: string | null
  sku: string | null
  base_price: string
  image_url: string | null
  is_available: boolean
  is_featured: boolean
  preparation_time_minutes: number
  calories: number | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface VariantGroup {
  id: number
  menu_item_id: number
  name: string
  selection_type: 'single' | 'multiple'
  is_required: boolean
  min_select: number
  max_select: number | null
  sort_order: number
}

export interface VariantOption {
  id: number
  variant_group_id: number
  name: string
  price_delta: string
  is_default: boolean
  is_available: boolean
  sort_order: number
}

export interface Coupon {
  id: number
  code: string
  type: 'fixed' | 'percentage'
  value: string
  min_order_amount: string
  max_discount_amount: string | null
  usage_limit: number | null
  usage_limit_per_user: number
  redemptions_count: number
  remaining_uses: number | null
  starts_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

export interface CartItemOption {
  id: number
  cart_item_id: number
  variant_option_id: number
  price_delta: string
}

export interface CartItem {
  id: number
  cart_id: number
  menu_item_id: number
  quantity: number
  unit_price: string
  notes: string | null
  created_at: string | null
  updated_at: string | null
  menu_item?: MenuItem
  options?: CartItemOption[]
}

export interface Cart {
  id: number
  user_id: number | null
  session_id: string | null
  order_type: 'delivery' | 'pickup'
  address_id: number | null
  coupon_id: number | null
  created_at: string | null
  updated_at: string | null
  cart_items?: CartItem[]
  address?: Address
  coupon?: Coupon
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed'

export interface OrderItemOption {
  id: number
  order_item_id: number
  option_name: string
  price_delta: string
}

export interface OrderItem {
  id: number
  order_id: number
  menu_item_id: number | null
  item_name: string
  unit_price: string
  quantity: number
  subtotal: string
  notes: string | null
  options?: OrderItemOption[]
}

export interface OrderStatusHistoryEntry {
  id: number
  order_id: number
  status: OrderStatus
  changed_by: number | null
  note: string | null
  created_at: string
}

export interface Payment {
  id: number
  order_id: number
  provider: 'stripe' | 'paypal' | 'gcash' | 'cod'
  provider_transaction_id: string | null
  amount: string
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  paid_at: string | null
  raw_response: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export interface Review {
  id: number
  order_id: number
  user_id: number
  menu_item_id: number | null
  rating: number
  comment: string | null
  created_at: string
}

export interface StoreSetting {
  id: number
  store_name: string
  is_open: boolean
  accepts_delivery: boolean
  accepts_pickup: boolean
  min_order_amount: string
  delivery_fee: string
  tax_rate_percent: string
  opening_time: string | null
  closing_time: string | null
  updated_at: string | null
}

export interface Order {
  id: number
  order_number: string
  user_id: number
  address_id: number | null
  rider_id: number | null
  assigned_at: string | null
  order_type: 'delivery' | 'pickup'
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method: string | null
  subtotal: string
  discount_amount: string
  delivery_fee: string
  tax_amount: string
  total_amount: string
  coupon_id: number | null
  notes: string | null
  scheduled_for: string | null
  placed_at: string
  created_at: string | null
  updated_at: string | null
  user?: User
  address?: Address
  rider?: User
  coupon?: Coupon
  order_items?: OrderItem[]
  status_history?: OrderStatusHistoryEntry[]
  payments?: Payment[]
  reviews?: Review[]
}

/**
 * A row of `GET /api/admin/riders` — the staff rider directory.
 *
 * The endpoint returns *User* records with the profile eager-loaded, NOT
 * RiderProfile rows: `RiderController@index` queries
 * `User::where('role', 'rider')->with('riderProfile')`. So `id` here is the user
 * id, which is also what `PUT /api/admin/orders/{order}/rider` expects as
 * `rider_id` (it validates against `users.id` with `role = rider`).
 *
 * The Orders table uses only `id` and `name`. `GET /api/admin/orders` does not
 * eager-load an order's `rider` relation, but it does return `rider_id`, so that
 * page joins the two here rather than asking the backend for another relation.
 *
 * Note the directory only lists users who still hold the rider role and are not
 * soft-deleted, so a lookup can miss a `rider_id` that an order still points at.
 *
 * There is no `status` column. Duty is the `is_active` boolean on the profile,
 * and it is enforced server-side: assigning an inactive rider 422s.
 */
export interface AdminRider {
  id: number
  name: string
  email: string
  phone: string | null
  /**
   * NOTE the snake_case. Laravel serialises relations with `Str::snake`, so the
   * `riderProfile()` relation arrives as `rider_profile`, not `riderProfile`.
   * Confirmed against a live `GET /api/admin/riders` response.
   */
  rider_profile: {
    photo_url: string | null
    vehicle_type: string | null
    plate_number: string | null
    is_active: boolean
  } | null
}

/* -------------------------------------------------------------------------
 * Types below have NO backend contract yet. They are defined here so the
 * frontend can be designed against them; whoever wires the API should keep
 * these shapes or update them in one place.
 * See docs/API_WIRING.md.
 * ---------------------------------------------------------------------- */

export type RiderStatus = 'available' | 'on_delivery' | 'offline'

export interface RiderProfile {
  id: number
  user_id: number
  vehicle: string | null
  license_plate: string | null
  status: RiderStatus
  is_active: boolean
  completed_today: number
  user?: User
  created_at: string | null
  updated_at: string | null
}

export interface RiderAssignment {
  order_id: number
  rider_id: number
  assigned_at: string
  rider?: RiderProfile
}

export interface AdminOverview {
  revenue_today: string
  orders_today: number
  active_orders: number
  completed_today: number
  cancelled_today: number
  pending_orders: number
  sold_out_items: number
  menu_items_total: number
  riders_available: number
  riders_on_delivery: number
  riders_offline: number
  store_open: boolean
  generated_at: string
}

/* -------------------------------------------------------------------------
 * REWARDS
 *
 * Live contract. Both surfaces exist:
 *
 *   customer  GET /api/rewards, GET /api/points, POST|DELETE /api/cart/reward
 *   admin     GET|POST /api/admin/rewards
 *             PUT|PATCH|DELETE /api/admin/rewards/{reward}
 *             GET /api/admin/rewards/redemptions
 *             GET /api/admin/points
 *
 * The catalogue lives in the `rewards` table (migration
 * 2026_10_08_000002) and is read at runtime through
 * `PointLedger::definitions()`. Shapes below were captured from live responses,
 * not inferred.
 *
 * Notes that matter when wiring:
 *
 *  - `GET /api/admin/rewards` returns `{ data: [...] }` with NO `meta` and no
 *    search/filter params. `unwrapList()` tolerates the missing envelope.
 *  - `GET /api/admin/rewards/redemptions` and `/api/admin/points` return
 *    `{ data: [...], meta: {...} }` and both serve `point_transactions` rows.
 *  - There is no `code`, `status`, `expires_at` or `used_at` anywhere. Rewards
 *    are spent instantly at checkout, so nothing is ever issued to present. The
 *    admin "Redemptions" tab is therefore a ledger view, not a code list.
 *  - `AdminRewardController::update` deliberately omits `key` from its
 *    validation, so the customer identifier is immutable after creation.
 *  - `DELETE` answers 409 when a cart or order still references the key.
 * ---------------------------------------------------------------------- */

/** `free_item` ships a menu item free, `voucher` is money off the order. */
export type RewardType = 'free_item' | 'voucher'

/** A row of `GET /api/admin/rewards` — the catalogue. */
export interface Reward {
  id: number
  /**
   * Immutable customer identifier, stored on `carts.reward_key` and
   * `orders.reward_key`. Slug-like, e.g. `chickenjoy-1pc`.
   */
  key: string
  label: string
  type: RewardType
  points_cost: number
  /** Required when `type === 'free_item'`. FK menu_items, nullOnDelete. */
  menu_item_id: number | null
  /** decimal:2 → STRING. Required when `type === 'voucher'`. */
  discount_amount: string | null
  /** decimal:2 → STRING. Vouchers only: minimum subtotal to redeem. */
  min_order_amount: string | null
  /**
   * Paused rewards stay in the table but are filtered out of the customer
   * catalogue, because `PointLedger::definitions()` selects `where is_active`.
   */
  is_active: boolean
  created_at: string | null
  updated_at: string | null
  /**
   * Eager-loaded as `menuItem:id,name,slug`. Laravel snake-cases relations, so
   * the key arrives as `menu_item`. Deliberately no `image_url` — see
   * `GET /api/menu`, which is where artwork comes from.
   */
  menu_item?: {
    id: number
    name: string
    slug: string
  } | null
}

/**
 * A row of `GET /api/admin/rewards/redemptions` and `GET /api/admin/points` —
 * the `point_transactions` ledger.
 *
 * Append-only and signed: positive earns, negative spends. Never UPDATE these.
 */
export interface RewardLedgerEntry {
  id: number
  user_id: number
  order_id: number | null
  points_delta: number
  balance_after: number
  reason: 'earned' | 'spent' | 'refunded'
  description: string | null
  created_at: string
  updated_at: string
  user?: {
    id: number
    name: string
    email: string
  } | null
  /** Present on `/redemptions`, which loads the order columns. */
  order?: {
    id: number
    order_number: string
    reward_key: string | null
    total_amount: string
  } | null
}
