import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { useCustomerOrder } from '@/context/customer-order-context';

export type StaffOrderStatus = 'incoming' | 'confirmed' | 'rejected';
export type MenuAvailability = 'available' | 'sold_out' | 'unavailable';
export type OrderType = 'Delivery' | 'Pickup';

export type StaffOrderItem = {
  name: string;
  quantity: number;
  note?: string;
};

export type StaffOrder = {
  id: string;
  orderNumber: string;
  receivedAt: string;
  customer: string;
  type: OrderType;
  items: StaffOrderItem[];
  total: number;
  status: StaffOrderStatus;
  phone?: string;
  address?: string;
  destinationName?: string;
  isSessionOrder?: boolean;
  rejectionReason?: string;
  staffNote?: string;
};

export type StaffMenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  emoji: string;
  availability: MenuAvailability;
  statusNote?: string;
};

export type StaffActivity = {
  id: string;
  kind: 'order_confirmed' | 'order_rejected' | 'menu_reported' | 'menu_restored' | 'rider_assigned';
  title: string;
  detail: string;
  time: string;
  recipient?: 'Admin';
};

type StaffDemoContextValue = {
  orders: StaffOrder[];
  menuItems: StaffMenuItem[];
  activities: StaffActivity[];
  confirmOrder: (orderId: string) => void;
  rejectOrder: (orderId: string, reason: string, note: string) => void;
  updateMenuAvailability: (
    itemId: string,
    availability: MenuAvailability,
    note: string,
  ) => void;
  addActivity: (activity: Omit<StaffActivity, 'id' | 'time'>) => void;
};

const INITIAL_ORDERS: StaffOrder[] = [
  {
    id: '1',
    orderNumber: 'JAL-230018',
    receivedAt: 'Just now',
    customer: 'Andrea M.',
    type: 'Delivery',
    items: [
      { name: 'Chickenjoy 2pc', quantity: 2, note: 'Spicy, extra gravy' },
      { name: 'Jolly Spaghetti', quantity: 1 },
      { name: 'Regular Coke', quantity: 2 },
    ],
    total: 597,
    status: 'incoming',
  },
  {
    id: '2',
    orderNumber: 'JAL-230017',
    receivedAt: '3 min ago',
    customer: 'Carlo D.',
    type: 'Pickup',
    items: [
      { name: 'Yumburger', quantity: 3, note: 'No mayo on one burger' },
      { name: 'Regular Fries', quantity: 2 },
    ],
    total: 385,
    status: 'incoming',
  },
  {
    id: '3',
    orderNumber: 'JAL-230016',
    receivedAt: '8 min ago',
    customer: 'Mika R.',
    type: 'Delivery',
    items: [
      { name: 'Chickenjoy 6pc', quantity: 1 },
      { name: 'Palabok Fiesta', quantity: 2 },
    ],
    total: 779,
    status: 'confirmed',
  },
  {
    id: '4',
    orderNumber: 'JAL-230012',
    receivedAt: '22 min ago',
    customer: 'Paolo S.',
    type: 'Pickup',
    items: [{ name: 'Champ Burger', quantity: 2 }],
    total: 358,
    status: 'rejected',
    rejectionReason: 'Item sold out',
    staffNote: 'Champ Burger patties are out of stock.',
  },
];

const INITIAL_MENU: StaffMenuItem[] = [
  { id: '1', name: 'Chickenjoy 1pc', category: 'Chickenjoy', price: 109, emoji: '🍗', availability: 'available' },
  { id: '2', name: 'Chickenjoy 2pc', category: 'Chickenjoy', price: 199, emoji: '🍗', availability: 'available' },
  { id: '3', name: 'Chickenjoy 6pc', category: 'Chickenjoy', price: 549, emoji: '🍗', availability: 'available' },
  { id: '4', name: 'Yumburger', category: 'Burgers', price: 89, emoji: '🍔', availability: 'available' },
  { id: '5', name: 'Champ Burger', category: 'Burgers', price: 179, emoji: '🍔', availability: 'sold_out', statusNote: 'Patties out of stock' },
  { id: '6', name: 'Burger Steak', category: 'Rice Meals', price: 139, emoji: '🍚', availability: 'available' },
  { id: '7', name: 'Palabok Fiesta', category: 'Pasta', price: 115, emoji: '🍝', availability: 'unavailable', statusNote: 'Noodle cooker maintenance' },
  { id: '8', name: 'Jolly Spaghetti', category: 'Pasta', price: 99, emoji: '🍝', availability: 'available' },
];

const INITIAL_ACTIVITY: StaffActivity[] = [
  {
    id: 'initial-1',
    kind: 'menu_reported',
    title: 'Champ Burger marked sold out',
    detail: 'Patties out of stock',
    recipient: 'Admin',
    time: '12 min ago',
  },
  {
    id: 'initial-2',
    kind: 'order_confirmed',
    title: 'Order JAL-230016 confirmed',
    detail: 'Kitchen can begin preparing 3 items.',
    time: '8 min ago',
  },
  {
    id: 'initial-3',
    kind: 'menu_reported',
    title: 'Palabok Fiesta marked unavailable',
    detail: 'Noodle cooker maintenance',
    recipient: 'Admin',
    time: '26 min ago',
  },
];

const StaffDemoContext = createContext<StaffDemoContextValue | undefined>(undefined);

function currentTime(): string {
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}

export function StaffDemoProvider({ children }: { children: ReactNode }) {
  const { orders: customerOrders, updateOrderStatus } = useCustomerOrder();
  const [seededOrders, setSeededOrders] = useState(INITIAL_ORDERS);
  const [menuItems, setMenuItems] = useState(INITIAL_MENU);
  const [activities, setActivities] = useState(INITIAL_ACTIVITY);

  const sessionOrders = useMemo<StaffOrder[]>(
    () =>
      customerOrders
        .filter((order) => order.isSessionOrder)
        .map((order) => ({
          id: `customer-${order.id}`,
          orderNumber: order.orderNumber,
          receivedAt: order.date,
          customer: order.customerName ?? 'Demo Customer',
          type: order.deliveryType === 'delivery' ? 'Delivery' : 'Pickup',
          items: order.lineItems ?? [],
          total: order.total,
          status: order.status === 'pending' ? 'incoming' : order.status === 'cancelled' ? 'rejected' : 'confirmed',
          phone: order.customerPhone,
          address: order.deliveryAddress,
          destinationName: order.destinationName,
          isSessionOrder: true,
          rejectionReason: order.cancelReason,
        })),
    [customerOrders],
  );
  const orders = useMemo(() => [...sessionOrders, ...seededOrders], [sessionOrders, seededOrders]);

  const addActivity = (activity: Omit<StaffActivity, 'id' | 'time'>) => {
    setActivities((current) => [
      { ...activity, id: `${Date.now()}-${Math.random()}`, time: currentTime() },
      ...current,
    ]);
  };

  const confirmOrder = (orderId: string) => {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order || order.status !== 'incoming') return;

    setSeededOrders((current) =>
      current.map((candidate) =>
        candidate.id === orderId ? { ...candidate, status: 'confirmed' } : candidate,
      ),
    );
    updateOrderStatus(order.orderNumber, 'preparing');
    addActivity({
      kind: 'order_confirmed',
      title: `Order ${order.orderNumber} confirmed`,
      detail: `Kitchen can begin preparing ${order.items.reduce((sum, item) => sum + item.quantity, 0)} items.`,
    });
  };

  const rejectOrder = (orderId: string, reason: string, note: string) => {
    const order = orders.find((candidate) => candidate.id === orderId);
    if (!order || order.status !== 'incoming') return;

    setSeededOrders((current) =>
      current.map((candidate) =>
        candidate.id === orderId
          ? { ...candidate, status: 'rejected', rejectionReason: reason, staffNote: note.trim() || undefined }
          : candidate,
      ),
    );
    updateOrderStatus(order.orderNumber, 'cancelled', note.trim() || reason);
    addActivity({
      kind: 'order_rejected',
      title: `Order ${order.orderNumber} rejected`,
      detail: note.trim() ? `${reason} — ${note.trim()}` : reason,
    });
  };

  const updateMenuAvailability = (
    itemId: string,
    availability: MenuAvailability,
    note: string,
  ) => {
    const item = menuItems.find((candidate) => candidate.id === itemId);
    if (!item || item.availability === availability) return;

    setMenuItems((current) =>
      current.map((candidate) =>
        candidate.id === itemId
          ? { ...candidate, availability, statusNote: availability === 'available' ? undefined : note.trim() || undefined }
          : candidate,
      ),
    );

    if (availability === 'available') {
      addActivity({
        kind: 'menu_restored',
        title: `${item.name} is available again`,
        detail: 'Menu availability restored by staff.',
        recipient: 'Admin',
      });
      return;
    }

    const statusLabel = availability === 'sold_out' ? 'sold out' : 'unavailable';
    addActivity({
      kind: 'menu_reported',
      title: `${item.name} marked ${statusLabel}`,
      detail: note.trim() || 'No additional note provided.',
      recipient: 'Admin',
    });
  };

  const value = { orders, menuItems, activities, confirmOrder, rejectOrder, updateMenuAvailability, addActivity };

  return <StaffDemoContext.Provider value={value}>{children}</StaffDemoContext.Provider>;
}

export function useStaffDemo(): StaffDemoContextValue {
  const context = useContext(StaffDemoContext);
  if (!context) throw new Error('useStaffDemo must be used inside StaffDemoProvider');
  return context;
}