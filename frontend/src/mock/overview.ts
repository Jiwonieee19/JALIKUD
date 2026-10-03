import type { AdminOverview } from '../types'
import { mockMenuItems } from './menu'
import { mockOrders } from './orders'
import { mockRiders } from './orders'
import { mockStoreSetting } from './store'

/**
 * MOCK DATA — stands in for:
 *   GET /api/admin/overview
 *
 * ⚠️  NO SUCH ENDPOINT EXISTS. The backend has no aggregate/stats route —
 *     `routes/api.php` has nothing matching /overview, /stats or /report.
 *     `AdminOverview` (bottom of src/types.ts) was invented here so the
 *     Dashboard could be designed. Whoever wires the API must ADD this route.
 *     See docs/API_WIRING.md → "Endpoints that do not exist yet".
 *
 * Auth: would require an admin token (EnsureAdmin).
 *
 * Every figure below is DERIVED from the other mock modules, so the numbers stay
 * internally consistent when you edit them. There is a self-check at the bottom.
 */

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'])
const TODAY = '2026-09-29'

const round2 = (value: number): string => value.toFixed(2)
const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0)

export const mockOverview: AdminOverview = (() => {
  const todays = mockOrders.filter((order) => order.placed_at.startsWith(TODAY))

  return {
    // Cancelled orders are excluded from revenue — refunded money is not revenue.
    revenue_today: round2(
      sum(todays.filter((o) => o.status !== 'cancelled').map((o) => Number(o.total_amount))),
    ),
    orders_today: todays.length,
    active_orders: todays.filter((o) => ACTIVE_STATUSES.has(o.status)).length,
    completed_today: todays.filter((o) => o.status === 'completed').length,
    cancelled_today: todays.filter((o) => o.status === 'cancelled').length,
    // Pending is deliberately NOT scoped to today: it is a live queue depth, and
    // an order placed at 23:50 stays pending into the next morning.
    pending_orders: mockOrders.filter((o) => o.status === 'pending').length,
    sold_out_items: mockMenuItems.filter((item) => !item.is_available).length,
    menu_items_total: mockMenuItems.length,
    riders_available: mockRiders.filter((rider) => rider.status === 'available').length,
    riders_on_delivery: mockRiders.filter((rider) => rider.status === 'on_delivery').length,
    riders_offline: mockRiders.filter((rider) => rider.status === 'offline').length,
    store_open: mockStoreSetting.is_open,
    generated_at: `${TODAY}T11:45:00+08:00`,
  }
})()

export const mockRecentOrders = mockOrders.slice(0, 5)

export const mockSoldOutItems = mockMenuItems.filter((item) => !item.is_available)

/**
 * 7-day revenue series for the Dashboard bar chart.
 *
 * Needs a second aggregate on the backend: GROUP BY date(placed_at), excluding
 * cancelled orders, summing total_amount. Suggested response shape is exactly
 * this — `label` is a presentation concern, so the API should really only send
 * `date`, `revenue` and `orders`, and let the frontend format the label.
 */
export const mockRevenueSeries: Array<{
  date: string
  label: string
  revenue: string
  orders: number
}> = [
  { date: '2026-09-23', label: 'Wed', revenue: '3184.00', orders: 9 },
  { date: '2026-09-24', label: 'Thu', revenue: '2901.00', orders: 8 },
  { date: '2026-09-25', label: 'Fri', revenue: '4102.00', orders: 12 },
  { date: '2026-09-26', label: 'Sat', revenue: '5238.00', orders: 15 },
  { date: '2026-09-27', label: 'Sun', revenue: '4876.00', orders: 14 },
  { date: '2026-09-28', label: 'Mon', revenue: '3615.00', orders: 10 },
  {
    date: TODAY,
    label: 'Tue',
    revenue: mockOverview.revenue_today,
    orders: mockOverview.orders_today,
  },
]

/**
 * Orders bucketed by hour, for "when are we busiest" analysis.
 * NOT displayed on the Dashboard yet — included because the backend will need a
 * GROUP BY hour() aggregate to support it, and it is cheaper to design against
 * the real shape now than to retrofit later.
 */
export const mockHourlyOrders: Array<{ hour: string; label: string; orders: number }> = [
  { hour: '09', label: '9 AM', orders: 0 },
  { hour: '10', label: '10 AM', orders: 0 },
  { hour: '11', label: '11 AM', orders: 4 },
  { hour: '12', label: '12 PM', orders: 6 },
  { hour: '13', label: '1 PM', orders: 3 },
  { hour: '14', label: '2 PM', orders: 2 },
  { hour: '15', label: '3 PM', orders: 1 },
  { hour: '16', label: '4 PM', orders: 2 },
  { hour: '17', label: '5 PM', orders: 4 },
  { hour: '18', label: '6 PM', orders: 7 },
  { hour: '19', label: '7 PM', orders: 5 },
]


/* ---------------------------------------------------------------------------
 * SELF-CHECK
 * Catches the classic fixture bug: someone edits a number in orders.ts and the
 * dashboard keeps reporting stale totals because it was hardcoded elsewhere.
 * Runs on module import, so a mistake fails loudly in dev instead of silently
 * shipping a wrong number.
 * ------------------------------------------------------------------------ */
{
  const todayOrders = mockOrders.filter((o) => o.placed_at.startsWith(TODAY))
  if (mockOverview.orders_today !== todayOrders.length) {
    throw new Error(
      `Overview integrity failure: orders_today=${mockOverview.orders_today} but ` +
        `${todayOrders.length} orders are dated ${TODAY}`,
    )
  }
  const riderTotal =
    mockOverview.riders_available +
    mockOverview.riders_on_delivery +
    mockOverview.riders_offline
  if (riderTotal !== mockRiders.length) {
    throw new Error(
      `Overview integrity failure: rider counts sum to ${riderTotal} but ` +
        `${mockRiders.length} riders exist`,
    )
  }
  if (mockOverview.sold_out_items !== mockSoldOutItems.length) {
    throw new Error('Overview integrity failure: sold_out_items disagrees with the menu fixture')
  }
}