import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth-context';
import { errorMessage } from '@/lib/api';
import { customerApi, type Address, type Cart, type CartItem, type Order, type OrderStatus, type PaymentMethod } from '@/lib/customer-api';

export type CustomerCartItem = { id: string; menuItemId: number; name: string; quantity: number; unitPrice: number; lineTotal: number; emoji: string; variant: string; source: 'menu' };
export type CustomerOrderStatus = OrderStatus;
export type CustomerPaymentMethod = PaymentMethod;
export type CustomerOrderItem = { name: string; quantity: number };
export type CustomerOrder = { id: string; orderNumber: string; date: string; status: CustomerOrderStatus; items: string; total: number; deliveryType: 'delivery' | 'pickup'; lineItems: CustomerOrderItem[]; deliveryAddress?: string; pickupCode?: string; cancelReason?: string; isSessionOrder?: boolean; customerName?: string; customerPhone?: string; destinationName?: string; paymentMethod?: PaymentMethod; paymentStatus?: string };
export type PointsEntry = { id: string; orderNumber: string; points: number; total: number; date: string; kind: 'earned' | 'redeemed'; label: string };
type AddCartItemInput = { id: string | number; name?: string; unitPrice?: number; emoji?: string; variant?: string; source?: string; maxQuantity?: number };
type CheckoutInput = { orderType: 'delivery' | 'pickup'; addressId?: number; couponCode?: string; notes?: string; paymentMethod?: PaymentMethod };

type CustomerOrderContextValue = {
  cart: Cart | null; cartItems: CustomerCartItem[]; orders: CustomerOrder[]; addresses: Address[];
  loading: boolean; mutating: boolean; error: string; pointsBalance: number; pointsHistory: PointsEntry[]; redeemedRewardIds: Set<string>;
  refreshCart: () => Promise<void>; refreshOrders: () => Promise<void>; refreshAddresses: () => Promise<void>;
  addToCart: (item: AddCartItemInput) => Promise<void>; changeQuantity: (itemId: string, delta: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>; quantityInCart: (menuItemId: string | number) => number;
  applyCoupon: (code: string) => Promise<void>; clearCoupon: () => Promise<void>; placeOrder: (input: CheckoutInput) => Promise<CustomerOrder>;
  selectReward: (rewardKey: string) => Promise<void>; clearReward: () => Promise<void>;
  updateOrderStatus: (orderNumber: string, status: CustomerOrderStatus, cancelReason?: string) => void;
  redeemReward: (rewardId: string, points: number) => boolean; clearError: () => void;
};

export const PESOS_PER_POINT = 10;
export function pointsForTotal(total: number): number { return total > 0 ? Math.floor(total / PESOS_PER_POINT) : 0; }
const CustomerOrderContext = createContext<CustomerOrderContextValue | undefined>(undefined);

function productEmoji(name: string): string {
  const value = name.toLowerCase();
  if (value.includes('burger')) return '🍔';
  if (value.includes('spaghetti') || value.includes('pasta')) return '🍝';
  if (value.includes('fries')) return '🍟';
  if (value.includes('rice')) return '🍚';
  return '🍗';
}

function mapCartItems(cart: Cart | null): CustomerCartItem[] {
  const rows = (cart?.cart_items ?? []).map((item) => ({
    id: String(item.id), menuItemId: item.menu_item_id, name: item.menu_item?.name ?? 'Menu item', quantity: item.quantity,
    unitPrice: Number(item.unit_price), lineTotal: Number(item.line_total ?? Number(item.unit_price) * item.quantity),
    emoji: productEmoji(item.menu_item?.name ?? ''),
    variant: item.options?.map((option) => option.variant_option?.name).filter(Boolean).join(' · ') || 'Regular', source: 'menu' as const,
  }));

  // Safety net for carts split before server-side merge-on-add: fold
  // identical rows (same item + variant + price) into one display row so the
  // cart never shows the same food twice. The server heals the stored rows on
  // the next cart fetch; quantity edits apply to the kept representative row.
  // Sorted oldest-first to match the server (which keeps the earliest row), so
  // row order — and React keys — stay stable across +/− taps.
  const merged = new Map<string, CustomerCartItem>();
  for (const row of rows) {
    const key = `${row.menuItemId}|${row.variant}|${row.unitPrice}`;
    const kept = merged.get(key);
    if (!kept) {
      merged.set(key, { ...row });
    } else {
      if (Number(row.id) < Number(kept.id)) {
        merged.set(key, { ...row, quantity: kept.quantity + row.quantity, lineTotal: Math.round((kept.lineTotal + row.lineTotal) * 100) / 100 });
      } else {
        kept.quantity += row.quantity;
        kept.lineTotal = Math.round((kept.lineTotal + row.lineTotal) * 100) / 100;
      }
    }
  }
  return [...merged.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

// Identity of a server cart line for merging: same item + same options +
// same notes. Mirrors the backend merge key so a display row resolves to all
// of its twin server rows, not just the representative one.
function serverLineKey(line: Pick<CartItem, 'menu_item_id' | 'notes'> & {
  options?: { variant_option_id?: number; variant_option?: { id?: number } | null }[];
}): string {
  const notes = line.notes !== null && line.notes !== undefined && line.notes.trim() !== '' ? line.notes.trim() : '';
  const optionIds = (line.options ?? [])
    .map((option) => Number(option.variant_option_id ?? option.variant_option?.id ?? 0))
    .sort((a, b) => a - b);
  return `${line.menu_item_id}|${notes}|${optionIds.join(',')}`;
}

function mapOrder(order: Order): CustomerOrder {
  const lines = order.order_items ?? [];
  const address = order.address ? [order.address.line1, order.address.line2, order.address.city, order.address.state].filter(Boolean).join(', ') : undefined;
  return {
    id: String(order.id), orderNumber: order.order_number,
    date: new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.placed_at)),
    status: order.status, items: lines.length ? lines.map((line) => `${line.item_name} ×${line.quantity}`).join(' · ') : 'Order details',
    lineItems: lines.map((line) => ({ name: line.item_name, quantity: line.quantity })), total: Number(order.total_amount),
    deliveryType: order.order_type, deliveryAddress: address,
    paymentMethod: order.payment_method === 'gcash' ? 'gcash' : order.payment_method === 'cod' ? 'cod' : undefined,
    paymentStatus: order.payment_status,
  };
}

export function CustomerOrderProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T> => {
    setMutating(true); setError('');
    try { return await operation(); }
    catch (caught) { setError(errorMessage(caught, 'The server is unavailable. Please try again later.')); throw caught; }
    finally { setMutating(false); }
  }, []);

  const refreshCart = useCallback(async () => { if (token && user?.role === 'customer') setCart((await customerApi.cart(token)).data); }, [token, user?.role]);
  // A cart mutation response must carry the full cart (cart_items array).
  // Older backends answered quantity updates with a single cart-item payload;
  // accepting that shape would replace the cart and render it empty. On a
  // shape mismatch, refetch the authoritative cart instead.
  const acceptCartPayload = useCallback(async (payload: unknown): Promise<void> => {
    if (payload !== null && typeof payload === 'object' && Array.isArray((payload as { cart_items?: unknown }).cart_items)) {
      setCart(payload as Cart);
    } else {
      await refreshCart();
    }
  }, [refreshCart]);
  const refreshOrders = useCallback(async () => { if (token && user?.role === 'customer') setOrders((await customerApi.orders(token)).map(mapOrder)); }, [token, user?.role]);
  const refreshAddresses = useCallback(async () => { if (token && user?.role === 'customer') setAddresses((await customerApi.addresses(token)).data); }, [token, user?.role]);

  useEffect(() => {
    if (!token || user?.role !== 'customer') return;
    // Initial authenticated synchronization is the purpose of this provider effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([refreshCart(), refreshOrders(), refreshAddresses()])
      .catch((caught) => setError(errorMessage(caught, 'The server is unavailable. Please try again later.')))
      .finally(() => setLoading(false));
  }, [refreshAddresses, refreshCart, refreshOrders, token, user?.role]);

  const addToCart = useCallback(async (item: AddCartItemInput) => {
    if (!token) throw new Error('Please sign in to add an item.');
    await run(async () => { await acceptCartPayload((await customerApi.addCartItem(token, Number(item.id))).data); });
  }, [acceptCartPayload, run, token]);
  const changeQuantity = useCallback(async (itemId: string, delta: number) => {
    if (!token || !cart) return;
    const anchor = cart.cart_items.find((candidate) => String(candidate.id) === itemId);
    if (!anchor) return;
    // A display row can hide twin server rows (same food added twice before
    // server-side merging). Operate on the whole group so minus always moves
    // the displayed total instead of getting stuck on a twin's remainder.
    const key = serverLineKey(anchor);
    const group = cart.cart_items
      .filter((candidate) => serverLineKey(candidate) === key)
      .sort((a, b) => a.id - b.id);
    await run(async () => {
      if (delta > 0) {
        if (anchor.quantity >= 99) return;
        await acceptCartPayload((await customerApi.updateCartItem(token, cart.id, anchor.id, Math.min(99, anchor.quantity + delta))).data);
        return;
      }
      const groupTotal = group.reduce((sum, line) => sum + line.quantity, 0);
      // Floor: the last single unit never goes below 1 (use Remove to delete).
      if (groupTotal <= 1) return;
      const target = group.find((line) => line.quantity > 1);
      if (target) {
        await acceptCartPayload((await customerApi.updateCartItem(token, cart.id, target.id, target.quantity - 1)).data);
      } else {
        // Every twin sits at qty 1: collapse one duplicate row. The food
        // itself stays in the cart via the remaining rows.
        const victim = group[group.length - 1];
        await customerApi.removeCartItem(token, cart.id, victim.id);
        await refreshCart();
      }
    });
  }, [acceptCartPayload, cart, refreshCart, run, token]);
  const removeFromCart = useCallback(async (itemId: string) => {
    if (!token || !cart) return;
    await run(async () => { await customerApi.removeCartItem(token, cart.id, Number(itemId)); await refreshCart(); });
  }, [cart, refreshCart, run, token]);
  const applyCoupon = useCallback(async (code: string) => {
    if (!token) return;
    await run(async () => { await acceptCartPayload((await customerApi.applyCoupon(token, code.trim().toUpperCase())).data); });
  }, [acceptCartPayload, run, token]);
  const clearCoupon = useCallback(async () => {
    if (!token) return;
    await run(async () => { await acceptCartPayload((await customerApi.clearCartCoupon(token)).data); });
  }, [acceptCartPayload, run, token]);
  const selectReward = useCallback(async (rewardKey: string) => {
    if (!token) throw new Error('Please sign in to redeem a reward.');
    await run(async () => { await acceptCartPayload((await customerApi.selectCartReward(token, rewardKey)).data); });
  }, [acceptCartPayload, run, token]);
  const clearReward = useCallback(async () => {
    if (!token) return;
    await run(async () => { await acceptCartPayload((await customerApi.clearCartReward(token)).data); });
  }, [acceptCartPayload, run, token]);
  const placeOrder = useCallback(async (input: CheckoutInput) => {
    if (!token) throw new Error('Please sign in to place an order.');
    return run(async () => {
      const response = await customerApi.placeOrder(token, { order_type: input.orderType,
        ...(input.orderType === 'delivery' ? { address_id: input.addressId } : {}),
        ...(input.couponCode ? { coupon_code: input.couponCode } : {}), ...(input.notes ? { notes: input.notes } : {}),
        ...(input.paymentMethod ? { payment_method: input.paymentMethod } : {}) });
      const order = mapOrder(response.data); await Promise.all([refreshCart(), refreshOrders()]); return order;
    });
  }, [refreshCart, refreshOrders, run, token]);

  const cartItems = useMemo(() => mapCartItems(cart), [cart]);
  const quantityInCart = useCallback((menuItemId: string | number) => cartItems.find((item) => item.menuItemId === Number(menuItemId))?.quantity ?? 0, [cartItems]);
  const value = useMemo<CustomerOrderContextValue>(() => ({
    cart, cartItems, orders, addresses, loading, mutating, error, pointsBalance: 0, pointsHistory: [], redeemedRewardIds: new Set<string>(),
    refreshCart, refreshOrders, refreshAddresses, addToCart, changeQuantity, removeFromCart, quantityInCart, applyCoupon, clearCoupon, placeOrder,
    selectReward, clearReward,
    updateOrderStatus: () => undefined, redeemReward: () => false, clearError: () => setError(''),
  }), [addresses, addToCart, applyCoupon, cart, cartItems, changeQuantity, clearCoupon, clearReward, error, loading, mutating, orders, placeOrder,
    quantityInCart, refreshAddresses, refreshCart, refreshOrders, removeFromCart, selectReward]);
  return <CustomerOrderContext.Provider value={value}>{children}</CustomerOrderContext.Provider>;
}

export function useCustomerOrder(): CustomerOrderContextValue {
  const context = useContext(CustomerOrderContext);
  if (!context) throw new Error('useCustomerOrder must be used inside CustomerOrderProvider');
  return context;
}
