import { Link } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import StatCard from '../components/ui/StatCard'
import Table from '../components/ui/Table'
import { formatDateTime, mockOrders, mockOverview, mockRecentOrders, mockRevenueSeries, mockSoldOutItems, peso } from '../mock'
import type { Order, OrderStatus } from '../types'

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

const peak = Math.max(...mockRevenueSeries.map((entry) => Number(entry.revenue)))

export default function DashboardPage() {
  const overview = mockOverview
  const peakOrder = mockOrders.reduce<Order | null>(
    (longest, order) => (order.order_number.length > (longest?.order_number.length ?? 0) ? order : longest),
    null,
  )

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Operations overview
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Live snapshot of the store as of {formatDateTime(overview.generated_at)}.
        </p>
      </header>

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
          hint={`${overview.riders_available} riders available · ${overview.riders_on_delivery} out`}
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
          <div className="flex h-44 items-end gap-2">
            {mockRevenueSeries.map((entry, index) => {
              const height = Math.round((Number(entry.revenue) / peak) * 100)
              const isToday = index === mockRevenueSeries.length - 1
              return (
                <div key={entry.date} className="group flex flex-1 flex-col items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 tabular-nums dark:text-slate-400">
                    {peso(entry.revenue).replace('.00', '')}
                  </span>
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      isToday ? 'bg-red-600' : 'bg-slate-200 group-hover:bg-slate-300 dark:bg-slate-700 dark:group-hover:bg-slate-600'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[11px] font-semibold text-slate-400">{entry.label}</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card
          title="Sold-out items"
          description={`${overview.sold_out_items} of ${overview.menu_items_total} items unavailable`}
        >
          {mockSoldOutItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Everything is in stock.
            </p>
          ) : (
            <ul className="space-y-2">
              {mockSoldOutItems.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 ring-inset dark:bg-slate-800/50 dark:ring-slate-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">SKU {item.sku}</p>
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
        description="The five most recent orders across the store."
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
          rows={mockRecentOrders}
          rowKey={(order) => order.id}
          columns={[
            {
              key: 'number',
              header: 'Order',
              render: (order: Order) => (
                <span className="font-bold text-slate-900 dark:text-white">{order.order_number}</span>
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
              render: (order: Order) => (
                <span className="capitalize">{order.order_type}</span>
              ),
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
                <span className="text-slate-500 dark:text-slate-400">{formatDateTime(order.placed_at)}</span>
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
        {peakOrder && (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Highest order number so far:{' '}
            <span className="font-bold text-slate-700 dark:text-slate-300">{peakOrder.order_number}</span>
          </p>
        )}
      </Card>
    </div>
  )
}
