import { useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import Tabs from '../components/ui/Tabs'
import { formatDate, paginate, peso } from '../mock'
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
 * Coupon money fields (value / min_order_amount) are
 * numeric(12,2) on the backend, so they arrive as strings.
 */

/**
 * A percentage discount stops here. 100% is a free order and the backend has no
 * reason to allow it, so the cap sits below it rather than at it.
 */
const PERCENT_MAX = 90

/** Rows per page in the coupon table. */
const PER_PAGE = 7

/** Below this a percentage is not worth a coupon row, so it is not accepted. */
const PERCENT_MIN = 5

/**
 * A percentage coupon is required to carry a real minimum spend, so a percent
 * off an arbitrarily small cart can never be created.
 */
const PERCENT_MIN_ORDER = 50

/**
 * How far a fixed amount has to stay under the minimum order. Without a gap a
 * fixed amount equal to the minimum would discount 100% of every cart that
 * qualifies for it.
 */
const FIXED_VALUE_GAP = 50

/**
 * decimal(10,2) arrives as "50.00". A peso amount should read that way at rest,
 * but a percentage has no cents, and a peso amount being typed into should not
 * have to be edited around a trailing ".00" — so only the exact ".00" goes.
 */
function trimZeroFraction(value: string): string {
  return value.endsWith('.00') ? value.slice(0, -3) : value
}

/** ISO-8601 from the API -> the `yyyy-mm-dd` an <input type="date"> expects. */
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

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
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    code: '',
    type: 'percentage',
    value: '',
    min_order_amount: '',
    usage_limit: '',
    usage_limit_per_user: '1',
    starts_at: '',
    expires_at: '',
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

  // Paged client-side: the endpoint has no search/status params yet, so the whole
  // set is fetched at the API's 100-row cap and filtered here first.
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

    /**
     * Guard clauses the inputs only hint at. A fixed amount needs a minimum to
     * be measured against, and must stay a gap below it, otherwise it discounts
     * 100% of every qualifying cart.
     */
    if (draft.type === 'fixed') {
      const amount = Number(draft.value)

      if (draft.min_order_amount === '' || minAmount === null) {
        setSaving(false)
        setFormErrors({ min_order_amount: 'Set a minimum order before the discount amount.' })
        return
      }

      // Checked before the amount: a negative minimum makes the cap
      // (minimum - gap) negative, which would otherwise surface as a confusing
      // "amount must be at most ₱-70.00" instead of the real problem.
      if (minAmount <= 0) {
        setSaving(false)
        setFormErrors({ min_order_amount: 'The minimum order must be above zero.' })
        return
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        setSaving(false)
        setFormErrors({ value: 'Enter a discount amount above zero.' })
        return
      }

      if (amount > minAmount - FIXED_VALUE_GAP) {
        setSaving(false)
        setFormErrors({
          value: `Must be at most ₱${(minAmount - FIXED_VALUE_GAP).toFixed(2)} — ₱${FIXED_VALUE_GAP} below the ₱${minAmount.toFixed(2)} minimum, so it is never a full discount.`,
        })
        return
      }
    }

    if (draft.type === 'percentage') {
      const percent = Number(draft.value)

      // Checked before the percentage, for the same reason the fixed branch
      // checks its minimum first — report the earlier field when both are wrong.
      if (draft.min_order_amount === '' || minAmount === null) {
        setSaving(false)
        setFormErrors({ min_order_amount: `Set a minimum order of at least ₱${PERCENT_MIN_ORDER}.` })
        return
      }

      if (minAmount < PERCENT_MIN_ORDER) {
        setSaving(false)
        setFormErrors({ min_order_amount: `Must be at least ₱${PERCENT_MIN_ORDER}.` })
        return
      }

      if (!Number.isFinite(percent) || percent < PERCENT_MIN) {
        setSaving(false)
        setFormErrors({ value: `Must be at least ${PERCENT_MIN}%.` })
        return
      }

      if (percent > PERCENT_MAX) {
        setSaving(false)
        setFormErrors({ value: `Must be ${PERCENT_MAX}% or less.` })
        return
      }
    }

    /**
     * `expires_at` is validated as `after:starts_at`, and that comparison
     * against a missing `starts_at` 422s. So an end date on its own is treated
     * as "valid from now until then" rather than being rejected. The end date
     * is sent at 23:59:59 so the coupon stays usable for the whole picked day
     * instead of expiring at midnight when it opens.
     */
    const startInstant =
      draft.starts_at !== ''
        ? `${draft.starts_at}T00:00:00`
        : draft.expires_at !== ''
          ? `${toDateInput(new Date().toISOString())}T00:00:00`
          : null

    const payload = {
      code,
      type: draft.type,
      value: draft.value,
      min_order_amount: draft.min_order_amount === '' ? null : draft.min_order_amount,
      usage_limit: draft.usage_limit === '' ? null : Number(draft.usage_limit),
      usage_limit_per_user: draft.usage_limit_per_user === '' ? null : Number(draft.usage_limit_per_user),
      starts_at: startInstant,
      expires_at: draft.expires_at === '' ? null : `${draft.expires_at}T23:59:59`,
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

  /** Every modal entry point resets the form so a previous attempt's errors never leak in. */
  function openCreate() {
    setDraft({
      code: '',
      type: 'percentage',
      value: '',
      min_order_amount: '',
      usage_limit: '',
      usage_limit_per_user: '1',
      starts_at: '',
      expires_at: '',
    })
    setFormErrors({})
    setCreating(true)
  }

  function closeModal() {
    setCreating(false)
    setEditing(null)
    setFormErrors({})
  }

  function openEdit(coupon: Coupon) {
    setDraft({
      code: coupon.code,
      type: coupon.type,
      value: coupon.type === 'percentage' ? trimZeroFraction(coupon.value) : coupon.value,
      min_order_amount: coupon.min_order_amount,
      usage_limit: coupon.usage_limit === null ? '' : String(coupon.usage_limit),
      usage_limit_per_user: String(coupon.usage_limit_per_user),
      starts_at: toDateInput(coupon.starts_at),
      expires_at: toDateInput(coupon.expires_at),
    })
    setEditing(coupon)
  }

  /**
   * Switching to percentage has to bring the value into 0-100, since the same
   * field means peso when fixed and percent otherwise.
   */
  function changeType(next: string) {
    setDraft({
      ...draft,
      type: next,
      value:
        next === 'percentage'
          ? trimZeroFraction(
              Number(draft.value) > PERCENT_MAX ? String(PERCENT_MAX) : draft.value,
            )
          : draft.value,
    })

    // The value rules are type-specific, so a message left over from the other
    // type ("Must be 90% or less." on a fixed amount) no longer applies.
    setFormErrors((current) => {
      if (!current.value) return current
      const next = { ...current }
      delete next.value
      return next
    })
  }

  const isFixed = draft.type === 'fixed'
  const minAmount = draft.min_order_amount === '' ? null : Number(draft.min_order_amount)

  /** A fixed amount is capped against the minimum, so the minimum comes first. */
  const valueLocked = isFixed && minAmount === null

  /** Fixed amounts are measured against the minimum; percentages stand alone. */
  const valueMax = isFixed ? (minAmount === null ? undefined : Math.max(minAmount - FIXED_VALUE_GAP, 0)) : PERCENT_MAX

  const valueMin = isFixed ? '0' : PERCENT_MIN

  /** A percentage coupon always needs a real minimum spend behind it. */
  const orderMin = isFixed ? '0' : PERCENT_MIN_ORDER

  const valueField = (
    <div>
      <Label htmlFor="cp-value" className="mb-1.5">
        {isFixed ? 'Amount value (₱)' : 'Percent value (%)'}
      </Label>
      <Input
        id="cp-value"
        type="number"
        min={valueMin}
        max={valueMax}
        step={isFixed ? '0.01' : 1}
        value={draft.value}
        disabled={valueLocked}
        onChange={(event) => setDraft({ ...draft, value: event.target.value })}
        onFocus={() => {
          // Clear the ".00" while typing a peso amount, so it doesn't have to be
          // selected and deleted by hand before entering a new figure.
          if (isFixed && draft.value.endsWith('.00')) {
            setDraft({ ...draft, value: trimZeroFraction(draft.value) })
          }
        }}
        onBlur={() => {
          // Put the cents back once the field is left alone.
          if (isFixed && draft.value !== '' && !draft.value.endsWith('.00')) {
            setDraft({ ...draft, value: Number(draft.value).toFixed(2) })
          }
        }}
        placeholder={isFixed ? '50.00' : '10'}
        aria-invalid={Boolean(formErrors.value)}
        className={
          formErrors.value
            ? 'border-red-500 dark:border-red-500'
            : valueLocked
              ? 'cursor-not-allowed opacity-50'
              : ''
        }
      />
      {formErrors.value && (
        <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">{formErrors.value}</p>
      )}
      {!formErrors.value && valueLocked && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Enter the minimum order first.</p>
      )}
    </div>
  )

  const minimumField = (
    <div>
      <Label htmlFor="cp-min" className="mb-1.5">
        Minimum order (₱)
      </Label>
      <Input
        id="cp-min"
        type="number"
        min={orderMin}
        step="0.01"
        value={draft.min_order_amount}
        onChange={(event) => setDraft({ ...draft, min_order_amount: event.target.value })}
        placeholder="200.00"
        aria-invalid={Boolean(formErrors.min_order_amount)}
        className={formErrors.min_order_amount ? 'border-red-500 dark:border-red-500' : ''}
      />
      {formErrors.min_order_amount && (
        <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">{formErrors.min_order_amount}</p>
      )}
    </div>
  )

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
        <Button onClick={openCreate}>+ New Coupon</Button>
      </header>

      {loadError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {loadError}
        </p>
      )}

      <Tabs
        value={filter}
        onChange={(next) => {
          setFilter(next)
          setPage(1)
        }}
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
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
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
            rows={pagedRows}
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

        <div className="mt-4">
          <Pagination
            page={meta.current_page}
            lastPage={meta.last_page}
            total={meta.total}
            perPage={meta.per_page}
            itemLabel="coupons"
            onPageChange={setPage}
          />
        </div>
      </Card>

      <Modal
        open={creating || editing !== null}
        onClose={closeModal}
        title={editing ? `Edit ${editing.code}` : 'New coupon'}
        description="Codes are matched case-insensitively at checkout."
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={() => void saveCoupon()} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Coupon'}
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
              onChange={(event) => changeType(event.target.value)}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </Select>
          </div>
          {valueField}
          {minimumField}
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
          <div>
            <Label htmlFor="cp-start" className="mb-1.5">
              Start date
            </Label>
            <Input
              id="cp-start"
              type="date"
              value={draft.starts_at}
              onChange={(event) => setDraft({ ...draft, starts_at: event.target.value })}
              aria-invalid={Boolean(formErrors.starts_at)}
              className={formErrors.starts_at ? 'border-red-500 dark:border-red-500' : ''}
            />
            {formErrors.starts_at && (
              <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">{formErrors.starts_at}</p>
            )}
          </div>
          <div>
            <Label htmlFor="cp-end" className="mb-1.5">
              End date
            </Label>
            <Input
              id="cp-end"
              type="date"
              value={draft.expires_at}
              min={draft.starts_at === '' ? undefined : draft.starts_at}
              onChange={(event) => setDraft({ ...draft, expires_at: event.target.value })}
              aria-invalid={Boolean(formErrors.expires_at)}
              className={formErrors.expires_at ? 'border-red-500 dark:border-red-500' : ''}
            />
            {formErrors.expires_at && (
              <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">{formErrors.expires_at}</p>
            )}
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
