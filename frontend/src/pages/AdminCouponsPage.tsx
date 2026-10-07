import { useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import Textarea from '../components/ui/Textarea'
import Tabs from '../components/ui/Tabs'
import { formatDate, peso } from '../mock'
import api, { fieldError } from '../services/api'
import { unwrapList } from '../services/lists'
import type { Coupon } from '../types'

/**
 * Talks to the real API:
 *   GET    /api/admin/coupons   ?active=true&per_page=
 *   POST   /api/admin/coupons
 *   PUT    /api/admin/coupons/{coupon}
 *   DELETE /api/admin/coupons/{coupon}
 *
 * Auth: admin token required (EnsureAdmin middleware). A customer or staff token
 * gets a 403 with "Forbidden. Administrator access required." which surfaces in
 * the page-level error banner rather than as an empty table.
 *
 * The list endpoint returns a raw LengthAwarePaginator, so its rows arrive at
 * `data.data` until backend ticket Task 1 normalises the envelope; unwrapList()
 * reads either shape. See services/lists.ts.
 *
 * KNOWN GAP: the endpoint only understands `active`, not `search`, so the search
 * box filters the fetched page in memory rather than on the server. That is
 * deliberate rather than faked — once ticket Task 2 adds the param, move the
 * term into the query string and drop the local filter.
 *
 * Coupon money fields (value / min_order_amount / max_discount_amount) are
 * numeric(12,2) on the backend, so they arrive as strings.
 */

function expiryTone(coupon: Coupon): 'success' | 'warning' | 'danger' {
  if (!coupon.expires_at) return 'success'
  const days = (new Date(coupon.expires_at).getTime() - Date.now()) / 86_400_000
  if (days < 0) return 'danger'
  if (days < 14) return 'warning'
  return 'success'
}

function expiryLabel(coupon: Coupon): string {
  if (!coupon.expires_at) return 'No expiry'
  const days = Math.round((new Date(coupon.expires_at).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return 'Expired'
  if (days === 0) return 'Expires today'
  return `Expires in ${days} days`
}

export default function AdminCouponsPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    code: '',
    type: 'percentage',
    value: '',
    min_order_amount: '',
    max_discount_amount: '',
    usage_limit: '',
    usage_limit_per_user: '1',
  })
  const [toast, setToast] = useState<string | null>(null)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  /**
   * Fetched once at the API's 100-row cap so the active/inactive tab counts and
   * the client-side search box cover the whole set. Once ticket Task 2 adds
   * `search`, this becomes a server-side query with a real paginator.
   */
  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/admin/coupons', { params: { per_page: 100 } })
      setCoupons(unwrapList<Coupon>(response.data).data)
      setLoadError('')
    } catch (err) {
      const errors = fieldError(err)
      setLoadError(errors.form ?? 'Could not load coupons.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return coupons.filter((coupon) => {
      const matchesFilter =
        filter === 'all' || (filter === 'active' ? coupon.is_active : !coupon.is_active)
      const matchesSearch = term.length === 0 || coupon.code.toLowerCase().includes(term)
      return matchesFilter && matchesSearch
    })
  }, [coupons, filter, search])

  const activeCount = coupons.filter((coupon) => coupon.is_active).length

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  /**
   * POST when creating, PUT /{id} when editing.
   *
   * CouponController validates `code` as unique, `expires_at` as `after:starts_at`,
   * and both usage limits as min:1. Numeric fields are sent as null when blank
   * rather than '', since the columns are numeric and '' would 422.
   */
  async function saveCoupon() {
    setSaving(true)
    setFormErrors({})

    const code = draft.code.trim().toUpperCase()

    const payload = {
      code,
      type: draft.type,
      value: draft.value,
      min_order_amount: draft.min_order_amount === '' ? null : draft.min_order_amount,
      max_discount_amount: draft.max_discount_amount === '' ? null : draft.max_discount_amount,
      usage_limit: draft.usage_limit === '' ? null : Number(draft.usage_limit),
      usage_limit_per_user: draft.usage_limit_per_user === '' ? null : Number(draft.usage_limit_per_user),
    }

    try {
      if (editing) {
        await api.put(`/admin/coupons/${editing.id}`, payload)
      } else {
        await api.post('/admin/coupons', payload)
      }

      await refresh()
      setCreating(false)
      setEditing(null)
      flash(editing ? `${payload.code} updated` : `${payload.code} created`)
    } catch (err) {
      const errors = fieldError(err)
      setFormErrors(errors)
      flash(errors.form ?? Object.values(errors)[0] ?? 'Could not save the coupon.')
    } finally {
      setSaving(false)
    }
  }

  /** DELETE /api/admin/coupons/{id}. */
  async function deleteCoupon(coupon: Coupon) {
    if (!window.confirm(`Delete coupon ${coupon.code}? This cannot be undone.`)) return

    try {
      await api.delete(`/admin/coupons/${coupon.id}`)
      await refresh()
      flash(`${coupon.code} deleted`)
    } catch (err) {
      const errors = fieldError(err)
      flash(errors.form ?? Object.values(errors)[0] ?? 'Could not delete the coupon.')
    }
  }

  /** PUT /api/admin/coupons/{id} { is_active } — the activate/pause toggle. */
  async function toggleActive(coupon: Coupon) {
    const next = !coupon.is_active

    setCoupons((current) =>
      current.map((candidate) =>
        candidate.id === coupon.id ? { ...candidate, is_active: next } : candidate,
      ),
    )

    try {
      await api.put(`/admin/coupons/${coupon.id}`, { is_active: next })
      flash(`${coupon.code} ${next ? 'activated' : 'paused'}`)
    } catch (err) {
      // Roll the optimistic flip back so the tabs never disagree with the API.
      setCoupons((current) =>
        current.map((candidate) =>
          candidate.id === coupon.id ? { ...candidate, is_active: coupon.is_active } : candidate,
        ),
      )
      const errors = fieldError(err)
      flash(errors.form ?? Object.values(errors)[0] ?? 'Could not update the coupon.')
    }
  }

  function openCreate() {
    setDraft({
      code: '',
      type: 'percentage',
      value: '',
      min_order_amount: '',
      max_discount_amount: '',
      usage_limit: '',
      usage_limit_per_user: '1',
    })
    setCreating(true)
  }

  function openEdit(coupon: Coupon) {
    setDraft({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      min_order_amount: coupon.min_order_amount,
      max_discount_amount: coupon.max_discount_amount ?? '',
      usage_limit: coupon.usage_limit === null ? '' : String(coupon.usage_limit),
      usage_limit_per_user: String(coupon.usage_limit_per_user),
    })
    setEditing(coupon)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Coupons &amp; deals
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {activeCount} active of {coupons.length} total
          </p>
        </div>
        <Button onClick={openCreate}>New coupon</Button>
      </header>

      {loadError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {loadError}
        </p>
      )}

      <Tabs
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All', count: coupons.length },
          { value: 'active', label: 'Active', count: activeCount },
          { value: 'inactive', label: 'Inactive', count: coupons.length - activeCount },
        ]}
      />

      <Card>
        <div className="mb-4">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by code…"
            aria-label="Search coupons"
            className="max-w-xs"
          />
        </div>

        {rows.length === 0 && !loading && !loadError ? (
          <EmptyState
            title="No coupons found"
            description="Create one to start running a promotion."
            action={<Button onClick={openCreate}>New coupon</Button>}
          />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : (
          <Table
            rows={rows}
            rowKey={(coupon) => coupon.id}
            columns={[
              {
                key: 'code',
                header: 'Code',
                render: (coupon: Coupon) => (
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-extrabold tracking-wider text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    {coupon.code}
                  </span>
                ),
              },
              {
                key: 'value',
                header: 'Discount',
                render: (coupon: Coupon) => (
                  <span className="font-extrabold">
                    {coupon.type === 'percentage'
                      ? `${Number(coupon.value).toFixed(0)}% off`
                      : `${peso(coupon.value)} off`}
                  </span>
                ),
              },
              {
                key: 'minimum',
                header: 'Minimum',
                align: 'right',
                render: (coupon: Coupon) => (
                  <span className="tabular-nums">{peso(coupon.min_order_amount)}</span>
                ),
              },
              {
                key: 'cap',
                header: 'Max discount',
                align: 'right',
                render: (coupon: Coupon) =>
                  coupon.max_discount_amount ? (
                    <span className="tabular-nums">{peso(coupon.max_discount_amount)}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  ),
              },
              {
                key: 'usage',
                header: 'Usage',
                align: 'center',
                render: (coupon: Coupon) => (
                  <span className="tabular-nums">
                    {coupon.usage_limit === null ? '∞' : coupon.usage_limit}
                    <span className="text-slate-400"> / {coupon.usage_limit_per_user} per user</span>
                  </span>
                ),
              },
              {
                key: 'expiry',
                header: 'Expiry',
                render: (coupon: Coupon) => (
                  <div className="space-y-1">
                    <Badge tone={expiryTone(coupon)}>{expiryLabel(coupon)}</Badge>
                    {coupon.expires_at && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(coupon.expires_at)}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (coupon: Coupon) =>
                  coupon.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Paused</Badge>,
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (coupon: Coupon) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => void toggleActive(coupon)}
                    >
                      {coupon.is_active ? 'Pause' : 'Activate'}
                    </Button>
                    <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => openEdit(coupon)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-2.5 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                      onClick={() => void deleteCoupon(coupon)}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        title={editing ? `Edit ${editing.code}` : 'New coupon'}
        description="Codes are matched case-insensitively at checkout."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(false)
                setEditing(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveCoupon()} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create coupon'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cp-code" className="mb-1.5">
              Code
            </Label>
            <Input
              id="cp-code"
              value={draft.code}
              onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })}
              placeholder="JALI50"
              required
              maxLength={50}
              aria-invalid={Boolean(formErrors.code)}
              className={`font-bold tracking-wider${
                formErrors.code ? ' border-red-500 dark:border-red-500' : ''
              }`}
            />
            <p
              className={`mt-1 text-xs ${
                formErrors.code
                  ? 'font-semibold text-red-600 dark:text-red-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {formErrors.code ?? 'Unique, up to 50 characters. Customers type this at checkout.'}
            </p>
          </div>
          <div>
            <Label htmlFor="cp-type" className="mb-1.5">
              Type
            </Label>
            <Select
              id="cp-type"
              value={draft.type}
              onChange={(event) => setDraft({ ...draft, type: event.target.value })}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="cp-value" className="mb-1.5">
              Value
            </Label>
            <Input
              id="cp-value"
              type="number"
              min="0"
              step="0.01"
              value={draft.value}
              onChange={(event) => setDraft({ ...draft, value: event.target.value })}
              placeholder="10.00"
            />
          </div>
          <div>
            <Label htmlFor="cp-min" className="mb-1.5">
              Minimum order (₱)
            </Label>
            <Input
              id="cp-min"
              type="number"
              min="0"
              step="0.01"
              value={draft.min_order_amount}
              onChange={(event) => setDraft({ ...draft, min_order_amount: event.target.value })}
              placeholder="200.00"
            />
          </div>
          <div>
            <Label htmlFor="cp-cap" className="mb-1.5">
              Max discount (₱)
            </Label>
            <Input
              id="cp-cap"
              type="number"
              min="0"
              step="0.01"
              value={draft.max_discount_amount}
              onChange={(event) => setDraft({ ...draft, max_discount_amount: event.target.value })}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="cp-usage" className="mb-1.5">
              Total usage limit
            </Label>
            <Input
              id="cp-usage"
              type="number"
              min="0"
              value={draft.usage_limit}
              onChange={(event) => setDraft({ ...draft, usage_limit: event.target.value })}
              placeholder="Unlimited"
            />
          </div>
          <div>
            <Label htmlFor="cp-peruser" className="mb-1.5">
              Limit per user
            </Label>
            <Input
              id="cp-peruser"
              type="number"
              min="1"
              value={draft.usage_limit_per_user}
              onChange={(event) => setDraft({ ...draft, usage_limit_per_user: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cp-dates" className="mb-1.5">
              Start / end dates
            </Label>
            <div className="flex gap-2">
              <Input type="date" aria-label="Start date" />
              <Input type="date" aria-label="End date" />
            </div>
            <Textarea className="mt-2 hidden" readOnly value="" />
          </div>
        </div>
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
