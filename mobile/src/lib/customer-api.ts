import { apiRequest } from '@/lib/api';
import type { User } from '@/lib/types';

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
};

export type VariantOption = { id: number; name: string; price_delta: string; is_available: boolean };
export type VariantGroup = {
  id: number;
  name: string;
  is_required: boolean;
  selection_type: 'single' | 'multiple';
  min_select: number;
  max_select: number | null;
  options?: VariantOption[];
  variant_options?: VariantOption[];
};

export type MenuItem = {
  id: number;
  category_id?: number;
  name: string;
  description: string | null;
  base_price: string;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  category: Category;
  variant_groups: VariantGroup[];
};

export type StoreSetting = {
  store_name: string;
  is_open: boolean;
  accepts_delivery: boolean;
  accepts_pickup: boolean;
  min_order_amount: string;
  delivery_fee: string;
  tax_rate_percent: string;
};

export type Address = {
  id: number;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: string | null;
  longitude: string | null;
  is_default: boolean;
};

export type AddressInput = {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country?: string;
  is_default?: boolean;
};

export type CartItem = {
  id: number;
  cart_id: number;
  menu_item_id: number;
  quantity: number;
  unit_price: string;
  notes: string | null;
  menu_item: MenuItem;
  options: { id: number; variant_option_id?: number; variant_option: VariantOption; price_delta: string }[];
  line_total?: number | string;
};

export type CartReward = { key: string; label: string };

export type Cart = {
  id: number;
  order_type: 'delivery' | 'pickup';
  address_id: number | null;
  coupon_id: number | null;
  reward_key: string | null;
  reward: CartReward | null;
  cart_items: CartItem[];
  address: Address | null;
  coupon: { id: number; code: string } | null;
  subtotal: number;
  discount_amount: number;
  reward_discount_amount: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  pricing_errors?: string[];
};

export type RewardMenuItem = {
  id: number;
  name: string;
  base_price: string;
  is_available: boolean;
};

export type Reward = {
  key: string;
  type: 'free_item' | 'voucher';
  label: string;
  points_cost: number;
  can_afford: boolean;
  is_available: boolean;
  discount_amount?: number;
  min_order_amount?: number;
  menu_item?: RewardMenuItem | null;
};

export type PointEntry = {
  id: number;
  points_delta: number;
  balance_after: number;
  reason: 'earned' | 'spent' | 'refunded';
  description: string | null;
  created_at: string;
  order?: { id: number; order_number: string } | null;
};

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'cod' | 'gcash';

export type Order = {
  id: number;
  order_number: string;
  order_type: 'delivery' | 'pickup';
  status: OrderStatus;
  payment_status?: string;
  payment_method?: PaymentMethod | string | null;
  total_amount: string;
  placed_at: string;
  notes: string | null;
  address?: Address | null;
  order_items?: { id: number; item_name: string; quantity: number; subtotal: string }[];
};

type DataResponse<T> = { data: T };

function paginatedItems<T>(response: DataResponse<Paginated<T> | T[]>): T[] {
  return Array.isArray(response.data) ? response.data : response.data.data;
}

export const customerApi = {
  storeSetting: () => apiRequest<DataResponse<StoreSetting | null>>('/store-setting'),
  categories: () => apiRequest<DataResponse<Paginated<Category>>>('/categories?active=true&per_page=100'),
  menu: () => apiRequest<DataResponse<Paginated<MenuItem>>>('/menu?available=true&per_page=100'),
  catalog: async () => {
    const [settings, categories, menu] = await Promise.all([
      apiRequest<DataResponse<StoreSetting | null>>('/store-setting'),
      apiRequest<DataResponse<Paginated<Category> | Category[]>>('/categories?active=true&per_page=100'),
      apiRequest<DataResponse<Paginated<MenuItem> | MenuItem[]>>('/menu?available=true&per_page=100'),
    ]);

    return {
      store: settings.data,
      categories: paginatedItems(categories),
      menuItems: paginatedItems(menu),
    };
  },
  cart: (token: string) => apiRequest<DataResponse<Cart>>('/cart', { token }),
  addCartItem: (token: string, menuItemId: number, quantity = 1) =>
    apiRequest<DataResponse<Cart>>('/cart/items', {
      token,
      method: 'POST',
      body: { menu_item_id: menuItemId, quantity },
    }),
  updateCartItem: (token: string, cartId: number, itemId: number, quantity: number) =>
    apiRequest<DataResponse<Cart>>(`/cart/items/${cartId}/${itemId}`, {
      token,
      method: 'PUT',
      body: { quantity },
    }),
  removeCartItem: (token: string, cartId: number, itemId: number) =>
    apiRequest<{ message: string }>(`/cart/items/${cartId}/${itemId}`, { token, method: 'DELETE' }),
  applyCoupon: (token: string, code: string) =>
    apiRequest<DataResponse<Cart>>('/cart/coupon', { token, method: 'POST', body: { code } }),
  rewards: (token: string) =>
    apiRequest<DataResponse<{ balance: number; rewards: Reward[] }>>('/rewards', { token }),
  points: (token: string) =>
    apiRequest<DataResponse<{ balance: number; history: PointEntry[] }>>('/points', { token }),
  selectCartReward: (token: string, rewardKey: string) =>
    apiRequest<DataResponse<Cart>>('/cart/reward', {
      token,
      method: 'POST',
      body: { reward_key: rewardKey },
    }),
  clearCartReward: (token: string) =>
    apiRequest<DataResponse<Cart>>('/cart/reward', { token, method: 'DELETE' }),
  addresses: (token: string) => apiRequest<DataResponse<Address[]>>('/addresses', { token }),
  createAddress: (token: string, input: AddressInput) =>
    apiRequest<DataResponse<Address>>('/addresses', { token, method: 'POST', body: input }),
  updateAddress: (token: string, id: number, input: Partial<AddressInput>) =>
    apiRequest<DataResponse<Address>>(`/addresses/${id}`, { token, method: 'PATCH', body: input }),
  deleteAddress: (token: string, id: number) =>
    apiRequest<{ message: string }>(`/addresses/${id}`, { token, method: 'DELETE' }),
  orders: (token: string) => apiRequest<DataResponse<Paginated<Order>>>('/orders?per_page=100', { token, cache: 'no-store' }),
  placeOrder: (
    token: string,
    input: { order_type: 'delivery' | 'pickup'; address_id?: number; coupon_code?: string; notes?: string; payment_method?: PaymentMethod },
  ) => apiRequest<DataResponse<Order>>('/orders', { token, method: 'POST', body: input }),
  updateProfile: (token: string, input: { name: string; email: string }) =>
    apiRequest<{ message: string; user: User }>('/profile', { token, method: 'PUT', body: input }),
  updatePassword: (token: string, input: { current_password: string; password: string; password_confirmation: string }) =>
    apiRequest<{ message: string }>('/password', { token, method: 'PUT', body: input }),
};
