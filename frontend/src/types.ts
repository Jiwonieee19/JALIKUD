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
 * The LOYALTY ENGINE EXISTS: `PointLedger` service, `point_transactions` table,
 * `GET /api/rewards`, `GET /api/points`, `POST|DELETE /api/cart/reward`, and 12
 * cases in backend/tests/Feature/RewardsTest.php. Mobile's Rewards tab is live
 * against it.
 *
 * What does NOT exist is the admin surface or a `rewards` table — the catalogue
 * is hardcoded in backend/config/rewards.php and read through
 * `PointLedger::definitions()`. So these types below are a DESIGN PROPOSAL for
 * AdminRewardsPage, not a description of a contract, and several fields have no
 * backend analogue at all:
 *
 *   stock           no oversell mechanism; "one unit in the cart" is the limit
 *   emoji           design-only, never had a column
 *   monetary_value  redundant with the backend's `discount_amount`
 *   title           the backend calls it `label`
 *   points_required the backend calls it `points_cost`
 *   menu_item_id    the backend resolves a `menu_item_slug`
 *
 * `RewardRedemption` is more than unimplemented — it is fictional. Rewards are
 * spent instantly at checkout via `spendForOrder`, so nothing is ever issued,
 * there is no code to present, and no issued/used/expired/revoked lifecycle.
 * An admin "Redemptions" tab should serve `point_transactions WHERE
 * reason='spent'` joined to `orders.reward_key` instead.
 *
 * The proposal of record, with schema and call sites, is in
 * docs/API_WIRING.md §4.
 * ---------------------------------------------------------------------- */

/** `free_item` ships a menu item free, `voucher` is money off the order. */
export type RewardType = 'free_item' | 'voucher'

export type RewardRedemptionStatus = 'issued' | 'used' | 'expired' | 'revoked'

export interface Reward {
  id: number
  title: string
  description: string | null
  type: RewardType
  /** Mobile called this `points`. Points are an integer count, never money. */
  points_required: number
  /** Mobile called this `worth`. decimal(12,2) → STRING. Null for non-cash. */
  monetary_value: string | null
  /** Required when type === 'free_item'. FK menu_items, nullOnDelete. */
  menu_item_id: number | null
  /** null = unlimited. Decremented on redemption, must lock to avoid oversell. */
  stock: number | null
  /** Mobile renders emoji; optional since the web UI uses text + badges. */
  emoji: string | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

/** One customer's redeemed reward. `code` is unique and what they present. */
export interface RewardRedemption {
  id: number
  reward_id: number
  user_id: number
  code: string
  status: RewardRedemptionStatus
  points_spent: number
  redeemed_at: string | null
  used_at: string | null
  expires_at: string | null
  reward?: Reward
  user?: User
}

/**
 * Append-only signed ledger. One row per earn or spend.
 * Positive = earned, negative = spent. Never UPDATE these rows.
 */
export interface RewardPointTransaction {
  id: number
  user_id: number
  order_id: number | null
  points: number
  reason: 'earned' | 'spent' | 'reversed' | 'adjusted'
  balance_after: number
  created_at: string
}
