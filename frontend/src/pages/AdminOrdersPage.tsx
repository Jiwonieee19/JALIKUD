import { useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import Tabs from '../components/ui/Tabs'
import api, { fieldError } from '../services/api'
import { unwrapList } from '../services/lists'
import { formatDateTime, paginate, peso } from '../mock'
import Pagination from '../components/ui/Pagination'
import type { AdminRider, Order, OrderStatus } from '../types'

/**
 * Read-only view of the order queue. Endpoints used (all behind `EnsureStaff`,
 * so admins pass too):
 *
 *   GET /api/admin/orders          ?per_page=100
 *   GET /api/admin/orders/{order}
 *   GET /api/admin/riders          ?per_page=100   (names for the Rider column)
 *   GET /api/admin/stats                        (tab badge counts)
 *
 * This page deliberately performs NO mutations. Kitchen status changes and
 * rider assignment live on the staff mobile client. GCash is recorded at
 * checkout and COD is recorded by the assigned rider on delivery completion,
 * so every row here has exactly one action: View.
 *
 * The whole order set is fetched once at the API's 100-row cap and filtered and
 * paged here, so the status tabs, the type dropdown and the search box all work
 * against the full set without a round trip per keystroke.
 */

/** Rows per page in the order table. */
const PER_PAGE = 7

/** The statuses in the orders_status_check CHECK constraint, in queue order. */
const ALL_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
]

const statusLabel: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const statusTone: Record<OrderStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'> = {
  pending: 'warning',
  confirmed: 'info',
  preparing: 'info',
  ready: 'brand',
  out_for_delivery: 'info',
  completed: 'success',
  cancelled: 'danger',
}

type Filter = OrderStatus | 'all'

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'pickup'>('all')
  const [selected, setSelected] = useState<Order | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [riders, setRiders] = useState<AdminRider[]>([])
  const [ridersError, setRidersError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  /**
   * Fetched once at the API's 100-row cap so the tabs, type dropdown and search
   * box cover the whole set. Filtering and paging then happen in `rows` below.
   */
  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/admin/orders', { params: { per_page: 100 } })
      setOrders(unwrapList<Order>(response.data).data)
      setLoadError('')
    } catch (err) {
      setLoadError(fieldError(err).form ?? 'Could not load orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Rider directory, used only to turn `order.rider_id` into a display name.
   *
   * `GET /admin/orders` does NOT eager-load the `rider` relation — see
   * `OrderController@index` — but it does return `rider_id`, and
   * `GET /admin/riders` returns every rider's name. So the table joins the two
   * client-side instead of asking the backend for one more relation.
   *
   * This is a lookup, not the page's data: a failure here keeps the previous map
   * and reports itself, but must never stop the order table from rendering.
   */
  const refreshRiders = useCallback(async () => {
    try {
      const response = await api.get('/admin/riders', { params: { per_page: 100 } })
      setRiders(unwrapList<AdminRider>(response.data).data)
      setRidersError('')
    } catch (err) {
      setRidersError(fieldError(err).form ?? 'Could not load rider names.')
    }
  }, [])

  /**
   * Tab badge counts come from GET /admin/stats, whose `orders_by_status` map
   * covers every order. There is no filtered status-count endpoint, so these
   * numbers describe the whole queue rather than the current search — they are a
   * sense of scale, not a count of the rows on screen.
   *
   * Failure here is non-fatal: badges fall back to the tab's own row count.
   */
  const refreshCounts = useCallback(async () => {
    try {
      const response = await api.get('/admin/stats')
      const stats = response.data?.data as { orders_by_status?: Record<string, number> } | undefined
      setStatusCounts(stats?.orders_by_status ?? {})
    } catch {
      setStatusCounts({})
    }
  }, [])

  useEffect(() => {
    void refresh()
    void refreshRiders()
    void refreshCounts()

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh()
        void refreshRiders()
        void refreshCounts()
      }
    }
    const interval = window.setInterval(refreshWhenVisible, 30_000)
    window.addEventListener('focus', refreshWhenVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [refresh, refreshRiders, refreshCounts])

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: orders.length }
    for (const status of ALL_STATUSES) {
      map[status] = statusCounts[status] ?? orders.filter((order) => order.status === status).length
    }
    return map
  }, [orders, statusCounts])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesStatus = filter === 'all' || order.status === filter
      const matchesType = typeFilter === 'all' || order.order_type === typeFilter
      const matchesSearch =
        term.length === 0 ||
        order.order_number.toLowerCase().includes(term) ||
        (order.user?.name ?? '').toLowerCase().includes(term)
      return matchesStatus && matchesType && matchesSearch
    })
  }, [orders, filter, search, typeFilter])

  /**
   * `rider_id` -> display name, for the Rider column.
   *
   * The directory only lists users that still hold the rider role and are not
   * soft-deleted, so a lookup can legitimately miss. `renderRider` below handles
   * that rather than reporting the order as unassigned.
   */
  const riderNames = useMemo(() => new Map(riders.map((rider) => [rider.id, rider.name])), [riders])

  const { data: pagedRows, meta } = paginate(
    rows,
    Math.min(page, Math.max(1, Math.ceil(rows.length / PER_PAGE))),
    PER_PAGE,
  )

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  /**
   * Show the row immediately, then upgrade it with the full payload — coupon,
   * payments, reviews, address, rider and full status history all load here but
   * not in the list response. `show()` does eager-load `rider`, so the detail's
   * Rider field is always the server's own answer.
   */
  async function openDetail(order: Order) {
    setSelected(order)
    try {
      const response = await api.get(`/admin/orders/${order.id}`)
      const full = response.data?.data as Order | undefined
      if (full) setSelected(full)
    } catch (err) {
      flash(fieldError(err).form ?? 'Could not load the order details.')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Orders</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Confirm, prepare and hand off every order coming into the store.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-36">
            <Select
              aria-label="Filter by fulfilment type"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value as typeof typeFilter)
                setPage(1)
              }}
            >
              <option value="all">All Types</option>
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
            </Select>
          </div>
        </div>
      </header>

      <Tabs
        value={filter}
        onChange={(next) => {
          setFilter(next)
          setPage(1)
        }}
        options={[
          { value: 'all', label: 'All', count: counts.all },
          ...ALL_STATUSES.map((status) => ({
            value: status,
            label: statusLabel[status],
            count: counts[status] ?? 0,
          })),
        ]}
      />

      <Card>
        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Search order number or customer…"
            aria-label="Search orders"
            className="block w-full max-w-sm rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-red-600 focus:ring-inset dark:bg-slate-800 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
          />
        </div>

        {loadError && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 ring-inset dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30"
          >
            {loadError}
          </p>
        )}

        {/* The rider directory only supplies display names, so this degrades the
            Rider column rather than blocking the page. */}
        {ridersError && (
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            {ridersError} Rider names fall back to their id.
          </p>
        )}

        {loading && orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading.</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No orders match"
            description="Try a different status filter, or clear the search box."
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9ZM5 6v1.5h4V6H5Zm0 3v1.5h6V9H5Zm0 3v1.5h4V12H5Zm7-6v1.5h3V6h-3Z" />
              </svg>
            }
          />
        ) : (
          <Table
            rows={pagedRows}
            rowKey={(order) => order.id}
            columns={[
              {
                key: 'number',
                header: 'Order',
                render: (order: Order) => (
                  <button
                    type="button"
                    onClick={() => void openDetail(order)}
                    className="font-extrabold text-slate-900 hover:text-red-600 dark:text-white dark:hover:text-red-400"
                  >
                    {order.order_number}
                  </button>
                ),
              },
              {
                key: 'customer',
                header: 'Customer',
                render: (order: Order) => (
                  <div>
                    <p className="font-bold">{order.user?.name ?? '—'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'items',
                header: 'Items',
                align: 'center',
                render: (order: Order) => (
                  <span className="tabular-nums">{order.order_items?.length ?? 0}</span>
                ),
              },
              {
                key: 'rider',
                header: 'Rider',
                render: (order: Order) => renderRider(order, riderNames),
              },
              {
                key: 'status',
                header: 'Status',
                render: (order: Order) => <Badge tone={statusTone[order.status]}>{statusLabel[order.status]}</Badge>,
              },
              {
                key: 'total',
                header: 'Total',
                align: 'right',
                render: (order: Order) => (
                  <span className="font-extrabold tabular-nums">{peso(order.total_amount)}</span>
                ),
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (order: Order) => (
                  <Button
                    variant="secondary"
                    className="px-2.5 py-1 text-xs"
                    onClick={() => void openDetail(order)}
                  >
                    View
                  </Button>
                ),
              },
            ]}
          />
        )}

        <div className="mt-4">
          <Pagination
            page={meta.current_page}
            lastPage={meta.last_page}
            total={meta.total}
            perPage={meta.per_page}
            itemLabel="orders"
            onPageChange={setPage}
          />
        </div>
      </Card>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.order_number ?? ''}
        description={
          selected
            ? `${selected.user?.name ?? '—'} · ${formatDateTime(selected.placed_at)}`
            : undefined
        }
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Status</p>
                <div className="mt-1">
                  <Badge tone={statusTone[selected.status]}>{statusLabel[selected.status]}</Badge>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Payment</p>
                <p className="mt-1 text-sm font-bold capitalize">
                  {selected.payment_method} · {selected.payment_status}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Rider</p>
                <p className="mt-1 text-sm font-bold">{selected.rider?.name ?? 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Placed</p>
                <p className="mt-1 text-sm">{formatDateTime(selected.placed_at)}</p>
              </div>
            </div>

            {selected.notes && (
              <div className="rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200 ring-inset dark:bg-amber-500/10 dark:ring-amber-500/30 dark:text-amber-200">
                <span className="font-bold">Note:</span> {selected.notes}
              </div>
            )}

            <div>
              <h3 className="mb-2 text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                Items
              </h3>
              <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200 ring-inset dark:divide-slate-800 dark:ring-slate-800">
                {(selected.order_items ?? []).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.item_name}</p>
                      {item.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-slate-500 tabular-nums">×{item.quantity}</span>
                      <span className="w-24 text-right font-extrabold tabular-nums">
                        {peso(item.subtotal)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
              <Row label="Subtotal" value={peso(selected.subtotal)} />
              {Number(selected.discount_amount) > 0 && (
                <Row label="Discount" value={`− ${peso(selected.discount_amount)}`} tone="success" />
              )}
              {Number(selected.delivery_fee) > 0 && (
                <Row label="Delivery fee" value={peso(selected.delivery_fee)} />
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold dark:border-slate-700">
                <span>Total</span>
                <span className="tabular-nums">{peso(selected.total_amount)}</span>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                Status history
              </h3>
              <ol className="space-y-2 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
                {(selected.status_history ?? []).map((entry) => (
                  <li key={entry.id} className="relative">
                    <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-red-600" />
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {statusLabel[entry.status]}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(entry.created_at)}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div
          role="status"
          className="fixed right-6 bottom-6 z-50 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg dark:bg-slate-700"
        >
          {toast}
        </div>
      )}
    </div>
  )
}

/**
 * The Rider cell.
 *
 * `GET /admin/orders` returns `rider_id` but does not eager-load the `rider`
 * relation, so the name comes from a client-side join against
 * `GET /admin/riders`. Three distinct states, deliberately not collapsed:
 *
 *   no rider_id on a delivery   -> Unassigned
 *   no rider_id on a pickup     -> nothing to deliver, so a dash
 *   rider_id with no match      -> Rider #<id>
 *
 * The third case is the one that must not read "Unassigned": the directory only
 * lists users who still hold the rider role and are not soft-deleted, so an order
 * can legitimately point at a rider who no longer appears there. Printing the id
 * keeps that honest.
 */
function renderRider(order: Order, names: Map<number, string>) {
  if (order.rider_id === null) {
    return order.order_type === 'delivery' ? (
      <Badge tone="warning">Unassigned</Badge>
    ) : (
      <span className="text-slate-400">—</span>
    )
  }

  const name = names.get(order.rider_id)

  return name ? (
    <span className="font-semibold">{name}</span>
  ) : (
    <span className="text-slate-400">Rider #{order.rider_id}</span>
  )
}

function Row({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success'
}) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={`font-bold tabular-nums ${
          tone === 'success' ? 'text-green-600 dark:text-green-400' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}
