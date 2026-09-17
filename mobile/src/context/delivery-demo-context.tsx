import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// Demo bridge between the staff UI and the rider UI. Staff assign riders to
// confirmed delivery orders here; the rider app sees the same data. In-memory
// only — restarting the app resets every rider and delivery.
export type RiderStatus = 'available' | 'on_delivery' | 'offline';
export type DeliveryStatus = 'ready' | 'assigned' | 'picked_up' | 'delivered';

export type Rider = {
  id: string;
  name: string;
  vehicle: string;
  phone: string;
  status: RiderStatus;
  completedToday: number;
};

export type DeliveryItem = { name: string; quantity: number };

export type Delivery = {
  id: string;
  orderNumber: string;
  customer: string;
  phone: string;
  address: string;
  items: DeliveryItem[];
  codAmount: number;
  distanceKm: number;
  deliveryFee: number;
  status: DeliveryStatus;
  riderId: string | null;
  store: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number; destinationName: string };
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
};

type DeliveryDemoContextValue = {
  riders: Rider[];
  deliveries: Delivery[];
  assignRider: (deliveryId: string, riderId: string) => void;
  pickupDelivery: (deliveryId: string) => void;
  completeDelivery: (deliveryId: string) => void;
  setRiderAvailability: (riderId: string, status: RiderStatus) => void;
};

const STORE_LOCATION = { latitude: 7.1904, longitude: 125.4539 };

const INITIAL_RIDERS: Rider[] = [
  { id: 'rider-jomar', name: 'Jomar Cruz', vehicle: 'Honda Beat · 8291 XYZ', phone: '09191234567', status: 'available', completedToday: 3 },
  { id: 'rider-marco', name: 'Marco Santillan', vehicle: 'Yamaha Mio · 7014 ABC', phone: '09201112233', status: 'available', completedToday: 1 },
  { id: 'rider-nilo', name: 'Nilo Ramos', vehicle: 'Honda Click · 5558 KLM', phone: '09995556677', status: 'offline', completedToday: 0 },
];

function buildDelivery(
  id: string,
  orderNumber: string,
  customer: string,
  phone: string,
  address: string,
  destinationName: string,
  destination: { latitude: number; longitude: number },
  items: DeliveryItem[],
  codAmount: number,
  distanceKm: number,
): Delivery {
  return {
    id,
    orderNumber,
    customer,
    phone,
    address,
    items,
    codAmount,
    distanceKm,
    deliveryFee: 49,
    status: 'ready',
    riderId: null,
    store: STORE_LOCATION,
    destination: { ...destination, destinationName },
    assignedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
  };
}

const INITIAL_DELIVERIES: Delivery[] = [
  buildDelivery(
    'd1',
    'JAL-230018',
    'Andrea M.',
    '0917 444 8890',
    'Blk 12 Lot 7, Sampaguita St., Matina, Davao City',
    "Andrea's House",
    { latitude: 7.0736, longitude: 125.6052 },
    [
      { name: 'Chickenjoy 2pc', quantity: 2 },
      { name: 'Jolly Spaghetti', quantity: 1 },
      { name: 'Regular Coke', quantity: 2 },
    ],
    597,
    6.8,
  ),
  buildDelivery(
    'd2',
    'JAL-230016',
    'Mika R.',
    '0918 222 4411',
    '17 Gemilina St., Bajada, Davao City',
    "Mika's Residence",
    { latitude: 7.0918, longitude: 125.6319 },
    [
      { name: 'Chickenjoy 6pc', quantity: 1 },
      { name: 'Palabok Fiesta', quantity: 2 },
    ],
    779,
    4.3,
  ),
];

const DeliveryDemoContext = createContext<DeliveryDemoContextValue | undefined>(undefined);

function currentTime(): string {
  return new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(new Date());
}

export function DeliveryDemoProvider({ children }: { children: ReactNode }) {
  const [riders, setRiders] = useState(INITIAL_RIDERS);
  const [deliveries, setDeliveries] = useState(INITIAL_DELIVERIES);

  const assignRider = useCallback((deliveryId: string, riderId: string) => {
    setDeliveries((current) =>
      current.map((delivery) =>
        delivery.id === deliveryId && delivery.status === 'ready'
          ? { ...delivery, status: 'assigned', riderId, assignedAt: currentTime() }
          : delivery,
      ),
    );
    setRiders((current) =>
      current.map((rider) => (rider.id === riderId ? { ...rider, status: 'on_delivery' } : rider)),
    );
  }, []);

  const pickupDelivery = useCallback((deliveryId: string) => {
    setDeliveries((current) =>
      current.map((delivery) =>
        delivery.id === deliveryId && delivery.status === 'assigned'
          ? { ...delivery, status: 'picked_up', pickedUpAt: currentTime() }
          : delivery,
      ),
    );
  }, []);

  const completeDelivery = useCallback((deliveryId: string) => {
    const delivery = deliveries.find((candidate) => candidate.id === deliveryId);
    if (!delivery || delivery.status !== 'picked_up' || !delivery.riderId) return;

    const riderId = delivery.riderId;
    setDeliveries((current) =>
      current.map((candidate) =>
        candidate.id === deliveryId
          ? { ...candidate, status: 'delivered', deliveredAt: currentTime() }
          : candidate,
      ),
    );
    setRiders((current) =>
      current.map((rider) =>
        rider.id === riderId
          ? { ...rider, status: 'available', completedToday: rider.completedToday + 1 }
          : rider,
      ),
    );
  }, [deliveries]);

  const setRiderAvailability = useCallback((riderId: string, status: RiderStatus) => {
    setRiders((current) =>
      current.map((rider) => (rider.id === riderId ? { ...rider, status } : rider)),
    );
  }, []);

  const value = useMemo(
    () => ({ riders, deliveries, assignRider, pickupDelivery, completeDelivery, setRiderAvailability }),
    [riders, deliveries, assignRider, pickupDelivery, completeDelivery, setRiderAvailability],
  );

  return <DeliveryDemoContext.Provider value={value}>{children}</DeliveryDemoContext.Provider>;
}

export function useDeliveryDemo(): DeliveryDemoContextValue {
  const context = useContext(DeliveryDemoContext);
  if (!context) throw new Error('useDeliveryDemo must be used inside DeliveryDemoProvider');
  return context;
}

export { currentTime as deliveryTimeNow };