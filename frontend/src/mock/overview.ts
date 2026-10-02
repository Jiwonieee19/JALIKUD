import type { AdminOverview } from '../types'
import { mockMenuItems } from './menu'
import { mockOrders } from './orders'
import { mockRiders } from './orders'
import { mockStoreSetting } from './store'
import { mockAdminUsers } from './users'

/**
 * MOCK DATA — stands in for:
 *   GET /api/admin/overview
 *
 * ⚠️  NO SUCH ENDPOINT EXISTS. The backend has no aggregate/stats route.
 *     `AdminOverview` in src/types.ts was invented here to let the dashboard
 *     be designed. Whoever wires the API must add this endpoint on the Laravel
 *     side (a single aggregate query over orders/menu_items/riders).
 *     See docs/API_WIRING.md → "Endpoints that do not exist yet".
 *
 * Auth: would require an admin token.
 *
 * Every figure below is DERIVED from the other mock modules so the numbers
 * stay internally consistent when you edit them.
 */

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'])

const sum = (values: number[]): number =>
  Number(values.reduce((total, value) => total + value, 0).toFixed(2))

export const mockOverview: AdminOverview = (() => {
  const todaysOrders = mockOrders.filter((order) => order.placed_at.startsWith('2026-09-29'))
  const activeOrders = todaysOrders.filter((order) => ACTIVE_STATUSES.has(order.status))

  return {
    revenue_today: sum(
      todaysOrders
        .filter((order) => order.status !== 'cancelled')
        .map((order) => Number(order.total_amount)),
    ).toFixed(2),
    orders_today: todaysOrders.length,
    active_orders: activeOrders.length,
    completed_today: todaysOrders.filter((order) => order.status === 'completed').length,
    cancelled_today: todaysOrders.filter((order) => order.status === 'cancelled').length,
    pending_orders: mockOrders.filter((order) => order.status === 'pending').length,
    sold_out_items: mockMenuItems.filter((item) => !item.is_available).length,
    menu_items_total: mockMenuItems.length,
    riders_available: mockRiders.filter((rider) => rider.status === 'available').length,
    riders_on_delivery: mockRiders.filter((rider) => rider.status === 'on_delivery').length,
    riders_offline: mockRiders.filter((rider) => rider.status === 'offline').length,
    store_open: mockStoreSetting.is_open,
    generated_at: '2026-09-29T11:45:00+08:00',
  }
})()

export const mockRecentOrders = mockOrders.slice(0, 5)

export const mockSoldOutItems = mockMenuItems.filter((item) => !item.is_available)

export const mockStaffAndAdmins = mockAdminUsers.filter(
  (user) => user.role === 'staff' || user.role === 'admin',
)

/** Aggregate revenue per day for the last 7 days (for the dashboard sparkline). */
export const mockRevenueSeries: Array<{ date: string; label: string; revenue: string; orders: number }> = [
  { date: '2026-09-23', label: 'Wed', revenue: '3184.00', orders: 9 },
  { date: '2026-09-24', label: 'Thu', revenue: '2901.00', orders: 8 },
  { date: '2026-09-25', label: 'Fri', revenue: '4102.00', orders: 12 },
  { date: '2026-09-26', label: 'Sat', revenue: '5238.00', orders: 15 },
  { date: '2026-09-27', label: 'Sun', revenue: '4876.00', orders: 14 },
  { date: '2026-09-28', label: 'Mon', revenue: '3615.00', orders: 10 },
  { date: '2026-09-29', label: 'Tue', revenue: mockOverview.revenue_today, orders: mockOverview.orders_today },
]
