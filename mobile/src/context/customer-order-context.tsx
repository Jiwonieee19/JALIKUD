import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { useAuthDemo } from '@/context/auth-demo-context';

export type CustomerCartItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  emoji: string;
  variant: string;
  source: 'menu' | 'reward' | 'deal';
  maxQuantity?: number;
};

export type CustomerOrderStatus = 'pending' | 'preparing' | 'out_for_delivery' | 'completed' | 'canceled';

export type CustomerOrderItem = {
  name: string;
  quantity: number;
};

export type CustomerOrder = {
  id: string;
  orderNumber: string;
  date: string;
  status: CustomerOrderStatus;
  items: string;
  total: number;
  deliveryType: 'delivery' | 'pickup';
  lineItems?: CustomerOrderItem[];
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  destinationName?: string;
  isSessionOrder?: boolean;
  pickupCode?: string;
  cancelReason?: string;
  pointsEarned?: number;
  pointsCredited?: boolean;
};

export type PointsEntry = {
  id: string;
  orderNumber: string;
  points: number;
  total: number;
  date: string;
  kind: 'earned' | 'redeemed';
  label: string;
};

type AddCartItemInput = Pick<CustomerCartItem, 'id' | 'name' | 'unitPrice' | 'emoji'> &
  Partial<Pick<CustomerCartItem, 'variant' | 'source' | 'maxQuantity'>>;

type CustomerOrderContextValue = {
  cartItems: CustomerCartItem[];
  orders: CustomerOrder[];
  pointsBalance: number;
  pointsHistory: PointsEntry[];
  redeemedRewardIds: Set<string>;
  addToCart: (item: AddCartItemInput) => void;
  changeQuantity: (itemId: string, delta: number) => void;
  removeFromCart: (itemId: string) => void;
  quantityInCart: (itemId: string) => number;
  placeOrder: (total: number) => CustomerOrder | null;
  updateOrderStatus: (
    orderNumber: string,
    status: CustomerOrderStatus,
    cancelReason?: string,
  ) => void;
  redeemReward: (rewardId: string, points: number) => boolean;
};

/** Loyalty rule: ₱10 spent = 1 point (rounded down). */
export const PESOS_PER_POINT = 10;

export function pointsForTotal(total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.floor(total / PESOS_PER_POINT);
}

const INITIAL_ORDERS: CustomerOrder[] = [
  {
    id: '1',
    orderNumber: 'JAL-230001',
    date: 'Aug 29, 12:47 PM',
    status: 'preparing',
    items: 'Chickenjoy 1pc ×2',
    total: 327,
    deliveryType: 'delivery',
  },
  {
    id: '2',
    orderNumber: 'JAL-229987',
    date: 'Aug 27, 6:12 PM',
    status: 'out_for_delivery',
    items: 'Yumburger ×1 · Champ Burger ×2',
    total: 487,
    deliveryType: 'delivery',
  },
  {
    id: '3',
    orderNumber: 'JAL-229902',
    date: 'Aug 25, 11:03 AM',
    status: 'completed',
    items: 'Jolly Spaghetti ×2 · Regular Fries ×1',
    total: 269,
    deliveryType: 'pickup',
    pickupCode: 'A42',
  },
  {
    id: '4',
    orderNumber: 'JAL-229764',
    date: 'Aug 22, 7:21 PM',
    status: 'canceled',
    items: 'Palabok Fiesta ×1',
    total: 115,
    deliveryType: 'delivery',
    cancelReason: 'User requested cancellation',
  },
];

const CustomerOrderContext = createContext<CustomerOrderContextValue | undefined>(undefined);

function formatOrderDate(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function CustomerOrderProvider({ children }: { children: ReactNode }) {
  const { current } = useAuthDemo();
  const [cartItems, setCartItems] = useState<CustomerCartItem[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>(INITIAL_ORDERS);
  const [pointsBalance, setPointsBalance] = useState(2450);
  const [pointsHistory, setPointsHistory] = useState<PointsEntry[]>([]);
  const [redeemedRewardIds, setRedeemedRewardIds] = useState<Set<string>>(new Set());

  const value = useMemo<CustomerOrderContextValue>(() => {
    const addToCart = (item: AddCartItemInput) => {
      setCartItems((current) => {
        const existing = current.find((candidate) => candidate.id === item.id);
        if (existing) {
          return current.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  quantity: Math.min(
                    candidate.quantity + 1,
                    candidate.maxQuantity ?? Number.POSITIVE_INFINITY,
                  ),
                }
              : candidate,
          );
        }
        return [
          ...current,
          {
            ...item,
            quantity: 1,
            variant: item.variant ?? 'Regular',
            source: item.source ?? 'menu',
          },
        ];
      });
    };

    const changeQuantity = (itemId: string, delta: number) => {
      setCartItems((current) =>
        current.map((item) =>
          item.id === itemId
            ? {
                ...item,
                quantity: Math.min(
                  Math.max(1, item.quantity + delta),
                  item.maxQuantity ?? Number.POSITIVE_INFINITY,
                ),
              }
            : item,
        ),
      );
    };

    const removeFromCart = (itemId: string) => {
      setCartItems((current) => current.filter((item) => item.id !== itemId));
    };

    const quantityInCart = (itemId: string) =>
      cartItems.find((item) => item.id === itemId)?.quantity ?? 0;

    const placeOrder = (total: number): CustomerOrder | null => {
      if (cartItems.length === 0) return null;

      const now = new Date();
      const id = `${now.getTime()}-${Math.random()}`;
      const earned = pointsForTotal(total);
      const order: CustomerOrder = {
        id,
        orderNumber: `JAL-${String(now.getTime() % 1_000_000).padStart(6, '0')}`,
        date: formatOrderDate(now),
        status: 'pending',
        items: cartItems.map((item) => `${item.name} ×${item.quantity}`).join(' · '),
        lineItems: cartItems.map((item) => ({ name: item.name, quantity: item.quantity })),
        total,
        deliveryType: 'delivery',
        customerName: current?.name ?? 'Demo Customer',
        customerPhone: current?.phone ?? '0917 000 0000',
        deliveryAddress: 'Customer address on file · Davao City',
        destinationName: `${current?.name ?? 'Customer'}'s Address`,
        isSessionOrder: true,
        pointsEarned: earned,
        pointsCredited: false,
      };

      setOrders((current) => [order, ...current]);
      setCartItems([]);
      return order;
    };

    const updateOrderStatus = (
      orderNumber: string,
      status: CustomerOrderStatus,
      cancelReason?: string,
    ) => {
      setOrders((currentOrders) =>
        currentOrders.map((order) => {
          if (order.orderNumber !== orderNumber || !order.isSessionOrder) return order;
          const earned = order.pointsEarned ?? pointsForTotal(order.total);
          // Credit loyalty points exactly once when the order completes.
          // Canceled orders never earn points.
          const shouldCredit = status === 'completed' && !order.pointsCredited;
          if (shouldCredit && earned > 0) {
            const stamped = formatOrderDate(new Date());
            setPointsBalance((current) => current + earned);
            setPointsHistory((current) => [
              {
                id: `${orderNumber}-earned`,
                orderNumber,
                points: earned,
                total: order.total,
                date: stamped,
                kind: 'earned',
                label: `Earned from ${orderNumber}`,
              },
              ...current,
            ]);
          }
          return {
            ...order,
            status,
            cancelReason: status === 'canceled' ? cancelReason : undefined,
            pointsEarned: earned,
            pointsCredited: order.pointsCredited || shouldCredit,
          };
        }),
      );
    };

    const redeemReward = (rewardId: string, points: number): boolean => {
      if (redeemedRewardIds.has(rewardId) || points > pointsBalance) return false;
      setPointsBalance((current) => current - points);
      setPointsHistory((current) => [
        {
          id: `${rewardId}-redeemed-${Date.now()}`,
          orderNumber: '',
          points,
          total: 0,
          date: formatOrderDate(new Date()),
          kind: 'redeemed',
          label: 'Reward redeemed',
        },
        ...current,
      ]);
      setRedeemedRewardIds((current) => new Set(current).add(rewardId));
      return true;
    };

    return {
      cartItems,
      orders,
      pointsBalance,
      pointsHistory,
      redeemedRewardIds,
      addToCart,
      changeQuantity,
      removeFromCart,
      quantityInCart,
      placeOrder,
      updateOrderStatus,
      redeemReward,
    };
  }, [cartItems, orders, pointsBalance, pointsHistory, redeemedRewardIds, current]);

  return <CustomerOrderContext.Provider value={value}>{children}</CustomerOrderContext.Provider>;
}

export function useCustomerOrder(): CustomerOrderContextValue {
  const context = useContext(CustomerOrderContext);
  if (!context) throw new Error('useCustomerOrder must be used inside CustomerOrderProvider');
  return context;
}