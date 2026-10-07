import { useMemo, useState } from 'react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import Tabs from '../components/ui/Tabs'
import Textarea from '../components/ui/Textarea'
import Label from '../components/ui/Label'
import { formatDateTime, mockOrders, mockRiders, peso } from '../mock'
import type { Order, OrderStatus } from '../types'

/**
 * MOCK-DATA PAGE — stands in for:
 *   GET /api/admin/orders            (?status=, ?search=, ?page=)
 *   GET /api/admin/orders/{order}
 *   PUT /api/admin/orders/{order}/status   body: { status, note? }
 *
 * TODO(next-dev): swap the imports at the top of this file for calls to
 * src/services/api, e.g.
 *   const { data } = await api.get('/admin/orders', { params: { status, search, page } })
 *   await api.put(`/admin/orders/${order.id}/status`, { status, note })
 *
 * Auth: admin token required (EnsureAdmin middleware).
 *
 * ⚠️ Known backend issue: OrderController@updateStatus correctly checks
 * isStaff(), but the route sits inside the EnsureAdmin group in
 * backend/routes/api.php, so staff get 403 before that check runs.
 * See docs/API_WIRING.md.
 */

/** Legal transitions, mirroring the orders_status_check CHECK constraint. */
const ALL_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
]

const FLOW: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'completed'],
  out_for_delivery: ['completed'],
  completed: [],
  cancelled: [],
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
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'pickup'>('all')
  const [selected, setSelected] = useState<Order | null>(null)
  const [assigning, setAssigning] = useState<Order | null>(null)
  const [riderChoice, setRiderChoice] = useState('')
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: mockOrders.length }
    for (const status of ALL_STATUSES) {
      map[status] = mockOrders.filter((order) => order.status === status).length
    }
    return map
  }, [])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return mockOrders.filter((order) => {
      const matchesStatus = filter === 'all' || order.status === filter
      const matchesType = typeFilter === 'all' || order.order_type === typeFilter
      const matchesSearch =
        term.length === 0 ||
        order.order_number.toLowerCase().includes(term) ||
        (order.user?.name ?? '').toLowerCase().includes(term)
      return matchesStatus && matchesType && matchesSearch
    })
  }, [filter, search, typeFilter])

  const availableRiders = mockRiders.filter((rider) => rider.status !== 'offline')

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
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
              onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}
            >
              <option value="all">All types</option>
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
            </Select>
          </div>
        </div>
      </header>

      <Tabs
        value={filter}
        onChange={setFilter}
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
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order number or customer…"
            aria-label="Search orders"
            className="block w-full max-w-sm rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-red-600 focus:ring-inset dark:bg-slate-800 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500"
          />
        </div>

        {rows.length === 0 ? (
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
            rows={rows}
            rowKey={(order) => order.id}
            columns={[
              {
                key: 'number',
                header: 'Order',
                render: (order: Order) => (
                  <button
                    type="button"
                    onClick={() => setSelected(order)}
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
                render: (order: Order) =>
                  order.rider ? (
                    <span className="font-semibold">{order.rider.name}</span>
                  ) : order.order_type === 'delivery' ? (
                    <Badge tone="warning">Unassigned</Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  ),
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
                  <div className="flex justify-end gap-2">
                    {FLOW[order.status].map((next) => (
                      <Button
                        key={next}
                        variant={next === 'cancelled' ? 'ghost' : 'secondary'}
                        className="px-2.5 py-1 text-xs"
                        onClick={() => flash(`${order.order_number} → ${statusLabel[next]}`)}
                      >
                        {statusLabel[next]}
                      </Button>
                    ))}
                    <Button
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => setSelected(order)}
                    >
                      View
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
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
          <>
            {selected && selected.order_type === 'delivery' && !selected.rider && (
              <Button
                variant="secondary"
                onClick={() => {
                  setRiderChoice('')
                  setAssigning(selected)
                }}
              >
                Assign rider
              </Button>
            )}
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
          </>
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

      <Modal
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        title="Assign a rider"
        description={assigning ? `Order ${assigning.order_number}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssigning(null)}>
              Cancel
            </Button>
            <Button
              disabled={!riderChoice}
              onClick={() => {
                const rider = mockRiders.find((candidate) => candidate.user_id === Number(riderChoice))
                flash(`${assigning?.order_number} assigned to ${rider?.user?.name ?? 'rider'}`)
                setAssigning(null)
              }}
            >
              Assign
            </Button>
          </>
        }
      >
        {availableRiders.length === 0 ? (
          <EmptyState
            title="No riders available"
            description="Every rider is either on a delivery or offline."
          />
        ) : (
          <fieldset>
            <legend className="mb-2 text-xs font-extrabold tracking-wider text-slate-500 uppercase">
              Available riders
            </legend>
            <div className="space-y-2">
              {availableRiders.map((rider) => (
                <label
                  key={rider.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset transition-colors ${
                    riderChoice === String(rider.user_id)
                      ? 'bg-red-50 ring-red-300 dark:bg-red-500/10 dark:ring-red-500/40'
                      : 'ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="rider"
                    value={rider.user_id}
                    checked={riderChoice === String(rider.user_id)}
                    onChange={(event) => setRiderChoice(event.target.value)}
                    className="h-4 w-4 accent-red-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">
                      {rider.user?.name}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {rider.vehicle} · {rider.license_plate}
                    </span>
                  </span>
                  <Badge tone={rider.status === 'available' ? 'success' : 'info'}>
                    {rider.status === 'available' ? 'Available' : 'On delivery'}
                  </Badge>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <Label htmlFor="assign-note" className="mb-1.5">
                Note (optional)
              </Label>
              <Textarea
                id="assign-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Anything the rider should know…"
                maxLength={500}
              />
            </div>
          </fieldset>
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
