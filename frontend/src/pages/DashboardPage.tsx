import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import Table from '../components/ui/Table'
import api, { fieldError } from '../services/api'
import { unwrapList } from '../services/lists'
import { formatDateTime, peso } from '../mock'
import type { AdminOverview, MenuItem, Order, OrderStatus } from '../types'

/**
 * Operations overview, live from the API.
 *
 *   GET /api/admin/overview            the "today" snapshot (AdminStatsController::overview)
 *   GET /api/admin/overview/revenue    7-day revenue series (revenueSeries)
 *   GET /api/admin/orders?per_page=5   five most recent, already ordered by placed_at desc
 *   GET /api/admin/menu?per_page=100   to name the sold-out items
 *
 * All four are behind `EnsureAdmin`. The snapshot is refetched on a 30s timer and
 * on window focus, matching the other admin pages, so the numbers stay current
 * while the screen is left open.
 *
 * REVENUE DEFINITION — two figures here do not mean the same thing:
 *   overview.revenue_today   excludes cancelled orders but counts them whether or
 *                            not they are paid. "Taken today".
 *   overview/revenue series  the same rule per day, so the card and the chart agree.
 *   /admin/stats.revenue     requires completed AND paid. A stricter figure, not
 *                            used here.
 * The chart says "gross of cancellations" so the difference is visible rather
 * than implied.
 *
 * NO MOCK DATA. Run `php artisan db:seed --class=DemoOrderSeeder` for a database
 * with content to look at; with no orders every figure is legitimately zero.
 */

const RECENT_ORDERS = 5

const statusTone: Record<OrderStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'> = {
  pending: 'warning',
  confirmed: 'info',
  preparing: 'info',
  ready: 'brand',
  out_for_delivery: 'info',
  completed: 'success',
  cancelled: 'danger',
}

const statusLabel: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
}

/** One row of `GET /api/admin/overview/revenue`. */
interface RevenuePoint {
  date: string
  revenue: string
  orders: number
}

/** `2026-10-08` -> `Thu 8`, for the chart axis. */
function dayLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric' })
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [series, setSeries] = useState<RevenuePoint[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  /** All four run together; all are needed for a complete first paint. */
  const refresh = useCallback(async () => {
    try {
      const [snapshot, revenue, orders, menu] = await Promise.all([
        api.get('/admin/overview'),
        api.get('/admin/overview/revenue'),
        api.get('/admin/orders', { params: { per_page: RECENT_ORDERS } }),
        api.get('/menu', { params: { per_page: 100 } }),
      ])

      setOverview((snapshot.data?.data ?? null) as AdminOverview | null)
      setSeries((revenue.data?.data ?? []) as RevenuePoint[])
      setRecentOrders(unwrapList<Order>(orders.data).data)
      setMenuItems(unwrapList<MenuItem>(menu.data).data)
      setLoadError('')
    } catch (err) {
      setLoadError(fieldError(err).form ?? 'Could not load the dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    const interval = window.setInterval(refreshWhenVisible, 30_000)
    window.addEventListener('focus', refreshWhenVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [refresh])

  /**
   * `available=false` is not a filter the API supports — MenuItemController@index
   * only honours `available === 'true'` — so unavailable items are picked out
   * client-side from the whole catalogue.
   */
  const soldOutItems = useMemo(() => menuItems.filter((item) => !item.is_available), [menuItems])

  /**
   * Tallest bar, floored at 1. An empty store reports zero revenue for all seven
   * days, and dividing by a zero peak would render every bar as NaN%.
   */
  const peak = useMemo(
    () => Math.max(1, ...series.map((point) => Number(point.revenue))),
    [series],
  )

  /**
   * Tallest bar in pixels.
   *
   * This was a percentage of the tallest bar, which silently rendered nothing:
   * the chart row is `items-end`, so each column is sized by its CONTENT rather
   * than stretched to the row, leaving the column `height: auto`. A percentage
   * height against an auto-height parent is defined as `auto`, and an empty div
   * with `auto` height is 0px -- so every bar collapsed while the amount and day
   * labels still rendered. Pixels sidestep the whole question; MAX_BAR_PX just
   * has to stay under the plot area minus the two label rows.
   */
  const MAX_BAR_PX = 128

  const barHeight = (amount: number): number =>
    amount > 0 ? Math.max(6, Math.round((amount / peak) * MAX_BAR_PX)) : 3

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Operations overview
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {overview
            ? `Live snapshot of the store as of ${formatDateTime(overview.generated_at)}.`
            : 'Loading the latest snapshot…'}
        </p>
      </header>

      {loadError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200 ring-inset dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30"
        >
          {loadError}
        </p>
      )}

      {loading && !overview ? (
        <Card>
          <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading dashboard…
          </p>
        </Card>
      ) : (
        overview && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Revenue today"
                value={peso(overview.revenue_today)}
                hint={`${overview.orders_today} orders today`}
                tone="brand"
                icon={
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm.75 4.5v.44c.9.14 1.5.75 1.56 1.72h-1.5c-.03-.38-.3-.6-.83-.6-.53 0-.79.2-.81.53 0 .3.2.44.83.6 1.16.29 1.83.8 1.83 1.85 0 1.03-.66 1.68-1.72 1.83v.5h-1.5v-.5c-1-.14-1.63-.75-1.69-1.78h1.5c.04.46.34.72.92.72.57 0 .85-.22.85-.58 0-.33-.22-.48-.85-.64-1.13-.28-1.8-.8-1.8-1.83 0-1 .64-1.66 1.69-1.81V5.5h1.5Z" />
                  </svg>
                }
              />
              <StatCard
                label="Active orders"
                value={overview.active_orders}
                hint={`${overview.pending_orders} awaiting confirmation`}
                tone="warning"
                icon={
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M9 2a1 1 0 0 0-1 1v1.06A6 6 0 0 0 4.5 12v3.5L3 17.25A.75.75 0 0 0 3.67 18h12.66a.75.75 0 0 0 .67-.75L15.5 15.5V12a6 6 0 0 0-3.5-5.44V3a1 1 0 0 0-1-1H9Zm-1 15.5V12a4 4 0 1 1 8 0v5.5H8Z" />
                  </svg>
                }
              />
              <StatCard
                label="Completed today"
                value={overview.completed_today}
                hint={`${overview.cancelled_today} cancelled`}
                tone="success"
                icon={
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm3.78 6.72-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06l1.47 1.47 3.97-3.97a.75.75 0 0 1 1.06 1.06Z" />
                  </svg>
                }
              />
              <StatCard
                label="Store status"
                value={overview.store_open ? 'Open' : 'Closed'}
                hint={`${overview.riders_available} available · ${overview.riders_on_delivery} out · ${overview.riders_offline} offline`}
                tone={overview.store_open ? 'success' : 'danger'}
                icon={
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                    <path d="M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM6.5 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm-7 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
                  </svg>
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card
                title="Revenue, last 7 days"
                description="Gross of cancellations."
                className="lg:col-span-2"
              >
                {series.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                    No revenue data yet.
                  </p>
                ) : (
                  <div className="flex h-56 items-end gap-2">
                    {series.map((point, index) => {
                      const amount = Number(point.revenue)
                      const isToday = index === series.length - 1
                      return (
                        <div
                          key={point.date}
                          className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
                        >
                          <span className="text-[11px] font-bold text-slate-500 tabular-nums dark:text-slate-400">
                            {peso(point.revenue).replace('.00', '')}
                          </span>
                          <div
                            // A zero day still gets a sliver so the bar reads as
                            // "nothing" rather than vanishing entirely.
                            style={{ height: `${barHeight(amount)}px` }}
                            className={`w-full rounded-t-lg transition-all ${
                              isToday
                                ? 'bg-red-600'
                                : 'bg-slate-200 group-hover:bg-slate-300 dark:bg-slate-700 dark:group-hover:bg-slate-600'
                            }`}
                          />
                          <span className="text-[11px] font-semibold text-slate-400">
                            {dayLabel(point.date)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>

              <Card
                title="Sold-out items"
                description={`${overview.sold_out_items} of ${overview.menu_items_total} items unavailable`}
              >
                {soldOutItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    Everything is in stock.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {soldOutItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 ring-inset dark:bg-slate-800/50 dark:ring-slate-700"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {item.name}
                          </p>
                          {item.sku && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">SKU {item.sku}</p>
                          )}
                        </div>
                        <Badge tone="danger">Sold out</Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  to="/admin/menu"
                  className="mt-4 inline-block text-sm font-bold text-red-600 hover:text-red-500 dark:text-red-400"
                >
                  Manage menu →
                </Link>
              </Card>
            </div>

            <Card
              title="Recent orders"
              description={`The ${RECENT_ORDERS} most recent orders across the store.`}
              action={
                <Link
                  to="/admin/orders"
                  className="text-sm font-bold text-red-600 hover:text-red-500 dark:text-red-400"
                >
                  View all →
                </Link>
              }
            >
              <Table
                rows={recentOrders}
                rowKey={(order) => order.id}
                empty={
                  <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    No orders yet.
                  </p>
                }
                columns={[
                  {
                    key: 'number',
                    header: 'Order',
                    render: (order: Order) => (
                      <span className="font-bold text-slate-900 dark:text-white">
                        {order.order_number}
                      </span>
                    ),
                  },
                  {
                    key: 'customer',
                    header: 'Customer',
                    render: (order: Order) => order.user?.name ?? '—',
                  },
                  {
                    key: 'type',
                    header: 'Type',
                    render: (order: Order) => <span className="capitalize">{order.order_type}</span>,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (order: Order) => <OrderStatusBadge status={order.status} />,
                  },
                  {
                    key: 'placed',
                    header: 'Placed',
                    render: (order: Order) => (
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatDateTime(order.placed_at)}
                      </span>
                    ),
                  },
                  {
                    key: 'total',
                    header: 'Total',
                    align: 'right',
                    render: (order: Order) => (
                      <span className="font-extrabold tabular-nums">{peso(order.total_amount)}</span>
                    ),
                  },
                ]}
              />
            </Card>
          </>
        )
      )}
    </div>
  )
}