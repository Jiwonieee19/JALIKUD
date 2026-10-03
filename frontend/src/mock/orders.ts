import type { Address, Order, OrderItem, OrderStatusHistoryEntry, RiderProfile, User } from '../types'
import { findMenuItem } from './menu'

/**
 * MOCK DATA — stands in for:
 *   GET /api/orders                     (customer's own)
 *   GET /api/orders/{order}
 *   POST /api/orders
 *   GET /api/admin/orders                <-- what the admin Orders page uses
 *   GET /api/admin/orders/{order}
 *   PUT /api/admin/orders/{order}/status <-- body: { status, note? }
 *
 * TODO(next-dev): swap for the real axios calls, e.g.
 *   const { data } = await api.get('/admin/orders', { params })
 *   return data.data
 *   await api.put(`/admin/orders/${id}/status`, { status, note })
 *
 * Auth: customer routes need a Sanctum token. Admin routes need admin role
 *       (EnsureAdmin middleware) — see the staff bug noted in API_WIRING.md.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THIS PAGE CANNOT BE WIRED UP AS-IS. Three backend gaps, in priority order:
 *
 * 1. `GET /api/admin/orders` DOES NOT EAGER-LOAD RELATIONS.
 *      OrderController.php:22-29
 *        $query = Order::query()->orderByDesc('placed_at');
 *        $orders = $query->paginate($request->perPage(10));
 *    Only `show()` calls ->with([...]) (:40). The Orders table renders the
 *    customer name and item count per row, so the list endpoint needs to load
 *    at least ['user', 'rider', 'orderItems']. Suggested:
 *        ->with(['user:id,name', 'rider:id,name', 'orderItems:id,order_id'])
 *
 * 2. PAGINATION BREAKS THE CLIENT-SIDE FILTERS.
 *    `index()` paginates 10/page and PaginationRequest (:20-21) accepts ONLY
 *    `page` and `per_page` — no `status`, no `search`. The status tabs and
 *    search box on the page filter in the browser, which silently only ever
 *    filters page 1. Two ways out, pick one:
 *      a) add `status` + `search` filters to OrderController@index, and add
 *         pagination UI to the page, or
 *      b) if one restaurant realistically only handles hundreds of orders per
 *         year, request `per_page=100` and keep client-side filtering.
 *
 * 3. RIDER ASSIGNMENT IS NOT IN THE API AT ALL.
 *    `orders.rider_id` (:17) and `Order::rider()` both exist, but there is no
 *    `PUT /admin/orders/{order}/rider` and no `GET /admin/riders`. The
 *    "Assign rider" modal is entirely mock. Needs:
 *      GET /api/admin/riders                    -> RiderProfile[]
 *      PUT /api/admin/orders/{order}/rider      body { rider_id } -> stamps assigned_at
 *
 * ---------------------------------------------------------------------------
 * FIELD → COLUMN MAP
 * Mirrors backend/database/migrations/2026_09_15_000012_create_orders_table.php
 * ---------------------------------------------------------------------------
 *   Order.id              → id
 *   Order.order_number    → order_number      varchar(30) UNIQUE
 *   Order.user_id         → user_id           FK users, restrictOnDelete
 *   Order.address_id      → address_id        FK addresses, NULL for pickup (:16)
 *   Order.rider_id        → rider_id          FK users, nullable (:17)
 *   Order.assigned_at     → assigned_at       timestamptz, nullable (:18)
 *   Order.order_type      → order_type        CHECK delivery|pickup
 *   Order.status          → status            CHECK 7 values, default 'pending'
 *   Order.payment_status  → payment_status    CHECK unpaid|paid|refunded|failed
 *   Order.payment_method  → payment_method    varchar(30), nullable
 *   Order.subtotal        → subtotal          decimal(10,2)
 *   Order.discount_amount → discount_amount   decimal(10,2) default 0
 *   Order.delivery_fee    → delivery_fee      decimal(10,2) default 0
 *   Order.tax_amount      → tax_amount        decimal(10,2) default 0
 *   Order.total_amount    → total_amount      decimal(10,2)
 *   Order.coupon_id       → coupon_id         FK coupons, nullable
 *   Order.notes           → notes             text, nullable
 *   Order.scheduled_for   → scheduled_for     timestamptz, NULL = ASAP (:31)
 *   Order.placed_at       → placed_at         timestamptz, useCurrent (:32)
 *
 * ⚠️ MONEY IS A STRING EVERYWHERE — every amount is decimal(10,2), which Eloquent
 *    serialises as "199.00", never a number. Using `number` introduces float
 *    rounding. Format via `peso()` in ./index.ts.
 *
 * ⚠️ `order_number` has NO GENERATOR in the backend — the migration only declares
 *    `varchar(30) UNIQUE`. If OrderController@store does not produce one, that is
 *    another gap. Values below follow the mobile app's "JAL-2300NN" pattern.
 *
 * Total integrity: the schema docs recommend enforcing
 *   total_amount = subtotal - discount_amount + delivery_fee + tax_amount
 * because all four are server-computed (:24-28). Every record here satisfies it.
 */

const customers: User[] = [
  { id: 9, name: 'Andrea Buenaventura', email: 'andrea@example.com', phone: '0917 444 8890', role: 'customer' },
  { id: 10, name: 'Paolo Mendoza', email: 'paolo@example.com', phone: '0918 222 3344', role: 'customer' },
  { id: 11, name: 'Grace Lim', email: 'grace@example.com', phone: '0921 333 4455', role: 'customer' },
  { id: 12, name: 'Daniel Oclarit', email: 'daniel@example.com', phone: '+63 917 555 0121', role: 'customer' },
]

const addresses: Address[] = [
  {
    id: 1, user_id: 9, label: 'Home', line1: 'Blk 12 Lot 7, Sampaguita St., Matina',
    line2: null, city: 'Davao City', state: null, postal_code: '8000', country: 'PH',
    latitude: '7.0736', longitude: '125.6052', is_default: true,
    created_at: '2026-09-20T11:12:00+08:00', updated_at: '2026-09-20T11:12:00+08:00',
  },
  {
    id: 2, user_id: 10, label: 'Work', line1: 'Unit 8, Felcris Centrale, Quimpo Blvd.',
    line2: '9th Floor', city: 'Davao City', state: null, postal_code: '8000', country: 'PH',
    latitude: '7.0595', longitude: '125.5942', is_default: true,
    created_at: '2026-09-21T08:45:00+08:00', updated_at: '2026-09-21T08:45:00+08:00',
  },
  {
    id: 3, user_id: 11, label: 'Home', line1: '18 Acacia St., Lanang',
    line2: null, city: 'Davao City', state: null, postal_code: '8000', country: 'PH',
    latitude: '7.1904', longitude: '125.4539', is_default: true,
    created_at: '2026-09-22T16:20:00+08:00', updated_at: '2026-09-22T16:20:00+08:00',
  },
  {
    id: 4, user_id: 12, label: null, line1: 'Rm 4, Torres St., Poblacion',
    line2: null, city: 'Davao City', state: null, postal_code: '8000', country: 'PH',
    latitude: '7.0674', longitude: '125.6108', is_default: true,
    created_at: '2026-09-24T12:00:00+08:00', updated_at: '2026-09-24T12:00:00+08:00',
  },
]

export const mockRiders: RiderProfile[] = [
  {
    id: 1, user_id: 6, vehicle: 'Honda Beat', license_plate: 'ABC 8291',
    status: 'available', is_active: true, completed_today: 3,
    user: customers[0] ? { id: 6, name: 'Jomar Cruz', email: 'jomar@jalikud.test', phone: '0919 123 4567', role: 'rider' } : undefined,
    created_at: '2026-09-16T10:30:00+08:00', updated_at: '2026-09-29T07:15:00+08:00',
  },
  {
    id: 2, user_id: 7, vehicle: 'Yamaha Mio', license_plate: 'ABC 7014',
    status: 'on_delivery', is_active: true, completed_today: 1,
    user: { id: 7, name: 'Marco Santillan', email: 'marco@jalikud.test', phone: '0920 111 2233', role: 'rider' },
    created_at: '2026-09-16T10:35:00+08:00', updated_at: '2026-09-29T08:02:00+08:00',
  },
  {
    id: 3, user_id: 8, vehicle: 'Honda Click', license_plate: 'ABC 5558',
    status: 'available', is_active: true, completed_today: 0,
    user: { id: 8, name: 'Nilo Ramos', email: 'nilo@jalikud.test', phone: '0999 555 6677', role: 'rider' },
    created_at: '2026-09-18T14:20:00+08:00', updated_at: '2026-09-29T06:40:00+08:00',
  },
  {
    id: 4, user_id: 13, vehicle: 'Honda Click', license_plate: 'ABC 3120',
    status: 'offline', is_active: true, completed_today: 0,
    user: { id: 13, name: 'Rodel Tapara', email: 'rodel@jalikud.test', phone: '0915 222 8899', role: 'rider' },
    created_at: '2026-09-19T09:10:00+08:00', updated_at: '2026-09-28T22:05:00+08:00',
  },
]

function item(id: number, name: string, unitPrice: string, quantity: number, notes: string | null = null): OrderItem {
  const subtotal = (Number(unitPrice) * quantity).toFixed(2)
  return {
    id,
    order_id: 0,
    menu_item_id: findMenuItem(id) ? id : null,
    item_name: name,
    unit_price: unitPrice,
    quantity,
    subtotal,
    notes,
    options: [],
  }
}

function history(orderId: number, entries: Array<[Order['status'], string, string | null]>): OrderStatusHistoryEntry[] {
  return entries.map(([status, at, note], index) => ({
    id: orderId * 10 + index,
    order_id: orderId,
    status,
    changed_by: 1,
    note,
    created_at: at,
  }))
}

interface Seed {
  id: number
  order_number: string
  user_id: number
  address_id: number | null
  rider_id: number | null
  order_type: 'delivery' | 'pickup'
  status: Order['status']
  payment_status: Order['payment_status']
  payment_method: string
  subtotal: string
  discount_amount: string
  delivery_fee: string
  tax_amount: string
  total_amount: string
  coupon_id: number | null
  notes: string | null
  scheduled_for?: string | null
  placed_at: string
  items: OrderItem[]
  history: OrderStatusHistoryEntry[]
  assigned_at?: string | null
}

const seeds: Seed[] = [
  {
    id: 1, order_number: 'JAL-230021', user_id: 9, address_id: 1, rider_id: null,
    order_type: 'delivery', status: 'pending', payment_status: 'unpaid', payment_method: 'cod',
    subtotal: '327.00', discount_amount: '0.00', delivery_fee: '49.00', tax_amount: '0.00', total_amount: '376.00',
    coupon_id: null, notes: null, placed_at: '2026-09-29T11:42:00+08:00',
    items: [item(2, 'Chickenjoy 2pc', '199.00', 1), item(15, 'Sotanghon', '49.00', 1), item(13, 'Crispy Fries', '79.00', 1)],
    history: history(1, [['pending', '2026-09-29T11:42:00+08:00', null]]),
  },
  {
    id: 2, order_number: 'JAL-230020', user_id: 10, address_id: 2, rider_id: null,
    order_type: 'delivery', status: 'confirmed', payment_status: 'unpaid', payment_method: 'cod',
    subtotal: '476.00', discount_amount: '0.00', delivery_fee: '49.00', tax_amount: '0.00', total_amount: '525.00',
    coupon_id: null, notes: 'Please call at the gate.', placed_at: '2026-09-29T11:18:00+08:00',
    items: [item(6, 'Champ Burger', '179.00', 1), item(11, 'Jolly Spaghetti', '99.00', 1), item(15, 'Sotanghon', '49.00', 1), item(14, 'Jolly Fries Bucket', '149.00', 1)],
    history: history(2, [
      ['pending', '2026-09-29T11:18:00+08:00', null],
      ['confirmed', '2026-09-29T11:24:00+08:00', 'Confirmed by Charmelle'],
    ]),
  },
  {
    id: 3, order_number: 'JAL-230019', user_id: 11, address_id: 3, rider_id: 2,
    order_type: 'delivery', status: 'preparing', payment_status: 'unpaid', payment_method: 'cod',
    subtotal: '296.00', discount_amount: '0.00', delivery_fee: '49.00', tax_amount: '0.00', total_amount: '345.00',
    coupon_id: null, notes: null, placed_at: '2026-09-29T10:55:00+08:00',
    assigned_at: '2026-09-29T11:08:00+08:00',
    items: [item(9, 'Jolly Spaghetti', '99.00', 2), item(15, 'Sotanghon', '49.00', 2)],
    history: history(3, [
      ['pending', '2026-09-29T10:55:00+08:00', null],
      ['confirmed', '2026-09-29T11:02:00+08:00', null],
      ['preparing', '2026-09-29T11:09:00+08:00', null],
    ]),
  },
  {
    id: 4, order_number: 'JAL-230018', user_id: 12, address_id: null, rider_id: null,
    order_type: 'pickup', status: 'ready', payment_status: 'unpaid', payment_method: 'cod',
    subtotal: '772.00', discount_amount: '0.00', delivery_fee: '0.00', tax_amount: '0.00', total_amount: '772.00',
    coupon_id: null, notes: 'Pickup at 17:00.', placed_at: '2026-09-29T10:30:00+08:00',
    items: [item(3, 'Chickenjoy 6pc', '549.00', 1), item(13, 'Crispy Fries', '79.00', 2), item(16, 'Coke Float', '65.00', 1)],
    history: history(4, [
      ['pending', '2026-09-29T10:30:00+08:00', null],
      ['confirmed', '2026-09-29T10:36:00+08:00', null],
      ['preparing', '2026-09-29T10:44:00+08:00', null],
      ['ready', '2026-09-29T11:12:00+08:00', 'Pickup code 4471'],
    ]),
  },
  {
    id: 5, order_number: 'JAL-230017', user_id: 9, address_id: 1, rider_id: 1,
    order_type: 'delivery', status: 'out_for_delivery', payment_status: 'paid', payment_method: 'gcash',
    subtotal: '582.00', discount_amount: '51.90', delivery_fee: '49.00', tax_amount: '0.00', total_amount: '579.10',
    coupon_id: 1, notes: null, placed_at: '2026-09-29T09:47:00+08:00',
    assigned_at: '2026-09-29T10:20:00+08:00',
    items: [item(7, 'Chicken & Burger Combo', '249.00', 1), item(16, 'Coke Float', '65.00', 1), item(14, 'Jolly Fries Bucket', '149.00', 1), item(12, 'Spaghetti Aglio Olio', '119.00', 1)],
    history: history(5, [
      ['pending', '2026-09-29T09:47:00+08:00', null],
      ['confirmed', '2026-09-29T09:53:00+08:00', null],
      ['preparing', '2026-09-29T10:01:00+08:00', null],
      ['ready', '2026-09-29T10:18:00+08:00', null],
      ['out_for_delivery', '2026-09-29T10:24:00+08:00', 'Rider: Jomar Cruz'],
    ]),
  },
  {
    id: 6, order_number: 'JAL-230016', user_id: 10, address_id: 2, rider_id: null,
    order_type: 'delivery', status: 'cancelled', payment_status: 'failed', payment_method: 'cod',
    subtotal: '179.00', discount_amount: '0.00', delivery_fee: '49.00', tax_amount: '0.00', total_amount: '228.00',
    coupon_id: null, notes: 'Customer changed their mind.', placed_at: '2026-09-28T19:12:00+08:00',
    items: [item(6, 'Champ Burger', '179.00', 1)],
    history: history(6, [
      ['pending', '2026-09-28T19:12:00+08:00', null],
      ['cancelled', '2026-09-28T19:20:00+08:00', 'Cancelled by customer'],
    ]),
  },
  {
    id: 7, order_number: 'JAL-230015', user_id: 11, address_id: 3, rider_id: 3,
    order_type: 'delivery', status: 'completed', payment_status: 'paid', payment_method: 'cod',
    subtotal: '445.00', discount_amount: '0.00', delivery_fee: '49.00', tax_amount: '0.00', total_amount: '494.00',
    coupon_id: null, notes: null, placed_at: '2026-09-28T18:02:00+08:00',
    assigned_at: '2026-09-28T18:30:00+08:00',
    items: [item(1, 'Chickenjoy 1pc', '109.00', 2), item(9, 'Jolly Spaghetti', '99.00', 1), item(15, 'Sotanghon', '49.00', 1), item(13, 'Crispy Fries', '79.00', 1)],
    history: history(7, [
      ['pending', '2026-09-28T18:02:00+08:00', null],
      ['confirmed', '2026-09-28T18:08:00+08:00', null],
      ['preparing', '2026-09-28T18:15:00+08:00', null],
      ['ready', '2026-09-28T18:28:00+08:00', null],
      ['out_for_delivery', '2026-09-28T18:33:00+08:00', null],
      ['completed', '2026-09-28T18:58:00+08:00', 'Delivered to Grace Lim'],
    ]),
  },
  {
    id: 8, order_number: 'JAL-230014', user_id: 12, address_id: 4, rider_id: null,
    order_type: 'pickup', status: 'completed', payment_status: 'paid', payment_method: 'gcash',
    subtotal: '277.00', discount_amount: '25.80', delivery_fee: '0.00', tax_amount: '0.00', total_amount: '251.20',
    coupon_id: 2, notes: null, placed_at: '2026-09-28T17:15:00+08:00',
    items: [item(5, 'Yumburger', '89.00', 1), item(8, 'Burger Steak', '139.00', 1), item(15, 'Sotanghon', '49.00', 1)],
    history: history(8, [
      ['pending', '2026-09-28T17:15:00+08:00', null],
      ['confirmed', '2026-09-28T17:20:00+08:00', null],
      ['preparing', '2026-09-28T17:26:00+08:00', null],
      ['ready', '2026-09-28T17:41:00+08:00', null],
      ['completed', '2026-09-28T18:05:00+08:00', 'Picked up by Daniel Oclarit'],
    ]),
  },

  // ---- Scheduled (ASAP vs pre-order). scheduled_for NULL = ASAP. ----
  {
    id: 9, order_number: 'JAL-230022', user_id: 10, address_id: 2, rider_id: null,
    order_type: 'delivery', status: 'pending', payment_status: 'paid', payment_method: 'gcash',
    subtotal: '663.00', discount_amount: '43.60', delivery_fee: '49.00', tax_amount: '44.14', total_amount: '712.54',
    coupon_id: 1, notes: 'Scheduled — please deliver after 1pm, we have a meeting.',
    scheduled_for: '2026-09-29T13:00:00+08:00', placed_at: '2026-09-29T11:58:00+08:00',
    items: [item(3, 'Chickenjoy 6pc', '549.00', 1), item(15, 'Sotanghon', '49.00', 1), item(16, 'Coke Float', '65.00', 1)],
    history: history(9, [['pending', '2026-09-29T11:58:00+08:00', null]]),
  },
  {
    id: 10, order_number: 'JAL-230023', user_id: 9, address_id: 1, rider_id: null,
    order_type: 'pickup', status: 'confirmed', payment_status: 'unpaid', payment_method: 'cod',
    subtotal: '342.00', discount_amount: '0.00', delivery_fee: '0.00', tax_amount: '0.00', total_amount: '342.00',
    coupon_id: null, notes: 'Collect at 5pm.',
    scheduled_for: '2026-09-29T17:00:00+08:00', placed_at: '2026-09-29T12:05:00+08:00',
    items: [item(13, 'Crispy Fries', '79.00', 2), item(16, 'Coke Float', '65.00', 1), item(12, 'Spaghetti Aglio Olio', '119.00', 1)],
    history: history(10, [
      ['pending', '2026-09-29T12:05:00+08:00', null],
      ['confirmed', '2026-09-29T12:09:00+08:00', 'Confirmed by Marites'],
    ]),
  },

  // ---- Cancelled with different reasons, incl. a refund ----
  {
    id: 11, order_number: 'JAL-230013', user_id: 11, address_id: 3, rider_id: null,
    order_type: 'delivery', status: 'cancelled', payment_status: 'refunded', payment_method: 'gcash',
    subtotal: '327.00', discount_amount: '0.00', delivery_fee: '49.00', tax_amount: '0.00', total_amount: '376.00',
    coupon_id: null, notes: 'Item sold out — Chickenjoy 6pc.',
    placed_at: '2026-09-28T14:30:00+08:00',
    items: [item(2, 'Chickenjoy 2pc', '199.00', 1), item(15, 'Sotanghon', '49.00', 1), item(13, 'Crispy Fries', '79.00', 1)],
    history: history(11, [
      ['pending', '2026-09-28T14:30:00+08:00', null],
      ['confirmed', '2026-09-28T14:36:00+08:00', null],
      ['cancelled', '2026-09-28T14:44:00+08:00', 'Item sold out. Refunded via GCash.'],
    ]),
  },
  {
    id: 12, order_number: 'JAL-230012', user_id: 12, address_id: null, rider_id: null,
    order_type: 'pickup', status: 'cancelled', payment_status: 'unpaid', payment_method: 'cod',
    subtotal: '164.00', discount_amount: '0.00', delivery_fee: '0.00', tax_amount: '0.00', total_amount: '164.00',
    coupon_id: null, notes: 'Customer did not arrive within 30 minutes.',
    placed_at: '2026-09-28T13:10:00+08:00',
    items: [item(11, 'Jolly Spaghetti', '99.00', 1), item(16, 'Coke Float', '65.00', 1)],
    history: history(12, [
      ['pending', '2026-09-28T13:10:00+08:00', null],
      ['confirmed', '2026-09-28T13:15:00+08:00', null],
      ['ready', '2026-09-28T13:35:00+08:00', null],
      ['cancelled', '2026-09-28T13:52:00+08:00', 'No-show, cancelled after 17 min'],
    ]),
  },

  // ---- Yesterday's completions, for the 7-day revenue chart ----
  {
    id: 13, order_number: 'JAL-230011', user_id: 9, address_id: 1, rider_id: 3,
    order_type: 'delivery', status: 'completed', payment_status: 'paid', payment_method: 'cod',
    subtotal: '377.00', discount_amount: '0.00', delivery_fee: '49.00', tax_amount: '0.00', total_amount: '426.00',
    coupon_id: null, notes: null, placed_at: '2026-09-28T12:15:00+08:00',
    assigned_at: '2026-09-28T12:44:00+08:00',
    items: [item(6, 'Champ Burger', '179.00', 1), item(14, 'Jolly Fries Bucket', '149.00', 1), item(15, 'Sotanghon', '49.00', 1)],
    history: history(13, [
      ['pending', '2026-09-28T12:15:00+08:00', null],
      ['confirmed', '2026-09-28T12:20:00+08:00', null],
      ['preparing', '2026-09-28T12:31:00+08:00', null],
      ['ready', '2026-09-28T12:42:00+08:00', null],
      ['out_for_delivery', '2026-09-28T12:47:00+08:00', 'Rider: Nilo Ramos'],
      ['completed', '2026-09-28T13:19:00+08:00', 'Delivered — customer confirmed'],
    ]),
  },
  {
    id: 14, order_number: 'JAL-230010', user_id: 10, address_id: 2, rider_id: 1,
    order_type: 'delivery', status: 'completed', payment_status: 'paid', payment_method: 'cod',
    subtotal: '677.00', discount_amount: '150.00', delivery_fee: '49.00', tax_amount: '0.00', total_amount: '576.00',
    coupon_id: 3, notes: null, placed_at: '2026-09-28T11:00:00+08:00',
    assigned_at: '2026-09-28T11:31:00+08:00',
    items: [item(3, 'Chickenjoy 6pc', '549.00', 1), item(13, 'Crispy Fries', '79.00', 1), item(15, 'Sotanghon', '49.00', 1)],
    history: history(14, [
      ['pending', '2026-09-28T11:00:00+08:00', null],
      ['confirmed', '2026-09-28T11:06:00+08:00', null],
      ['preparing', '2026-09-28T11:15:00+08:00', null],
      ['ready', '2026-09-28T11:29:00+08:00', null],
      ['out_for_delivery', '2026-09-28T11:34:00+08:00', 'Rider: Jomar Cruz'],
      ['completed', '2026-09-28T12:02:00+08:00', 'Delivered'],
    ]),
  },
]

export const mockOrders: Order[] = seeds.map((seed) => {
  const user = customers.find((candidate) => candidate.id === seed.user_id)
  const rider = mockRiders.find((candidate) => candidate.id === seed.rider_id)
  return {
    id: seed.id,
    order_number: seed.order_number,
    user_id: seed.user_id,
    address_id: seed.address_id,
    rider_id: seed.rider_id,
    assigned_at: seed.assigned_at ?? null,
    order_type: seed.order_type,
    status: seed.status,
    payment_status: seed.payment_status,
    payment_method: seed.payment_method,
    subtotal: seed.subtotal,
    discount_amount: seed.discount_amount,
    delivery_fee: seed.delivery_fee,
    tax_amount: seed.tax_amount,
    total_amount: seed.total_amount,
    coupon_id: seed.coupon_id,
    notes: seed.notes,
    scheduled_for: seed.scheduled_for ?? null,
    placed_at: seed.placed_at,
    created_at: seed.placed_at,
    updated_at: seed.placed_at,
    user,
    address: addresses.find((address) => address.id === seed.address_id),
    rider: rider?.user,
    order_items: seed.items.map((entry) => ({ ...entry, order_id: seed.id })),
    status_history: seed.history,
    payments: [],
    reviews: [],
  }
})

/**
 * Total-integrity assertions. The schema docs recommend the backend enforce:
 *
 *   1. subtotal = Σ (order_items.unit_price × quantity)
 *   2. total_amount = subtotal - discount_amount + delivery_fee + tax_amount
 *
 * ...with all four amount columns server-computed (see the migration, :24-28).
 *
 * Check 1 was MISSING originally and 10 of the 14 fixture orders silently
 * disagreed with their own line items. Both are asserted here so a hand-edit
 * fails on import in dev rather than shipping a wrong number to the backend.
 */
for (const order of mockOrders) {
  const itemsTotal = (order.order_items ?? []).reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0,
  )
  const declaredSubtotal = Number(order.subtotal)

  if (Math.abs(itemsTotal - declaredSubtotal) > 0.005) {
    throw new Error(
      `Mock data integrity failure on ${order.order_number}: subtotal is ` +
        `${declaredSubtotal.toFixed(2)} but its line items sum to ` +
        `${itemsTotal.toFixed(2)}. Recompute subtotal from order_items.`,
    )
  }

  const expectedTotal =
    declaredSubtotal -
    Number(order.discount_amount) +
    Number(order.delivery_fee) +
    Number(order.tax_amount)
  if (Math.abs(expectedTotal - Number(order.total_amount)) > 0.005) {
    throw new Error(
      `Mock data integrity failure on ${order.order_number}: expected total ` +
        `${expectedTotal.toFixed(2)} but got ${order.total_amount}`,
    )
  }

  for (const item of order.order_items ?? []) {
    const expectedLine = Number(item.unit_price) * item.quantity
    if (Math.abs(expectedLine - Number(item.subtotal)) > 0.005) {
      throw new Error(
        `Mock data integrity failure on ${order.order_number}, line "${item.item_name}": ` +
          `subtotal is ${item.subtotal} but unit_price × quantity is ` +
          `${expectedLine.toFixed(2)}`,
      )
    }
  }
}
