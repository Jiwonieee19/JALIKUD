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
