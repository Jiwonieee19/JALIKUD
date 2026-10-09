import { useCallback, useEffect, useMemo, useState } from 'react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import Tabs from '../components/ui/Tabs'
import RewardThumb from '../components/ui/RewardThumb'
import Pagination from '../components/ui/Pagination'
import api, { fieldError } from '../services/api'
import { unwrapList } from '../services/lists'
import { formatDate, paginate, peso } from '../mock'
import type { MenuItem, Reward, RewardLedgerEntry } from '../types'

/**
 * Live loyalty catalogue. Endpoints (all behind `EnsureAdmin`):
 *
 *   GET    /api/admin/rewards                     the catalogue — returns
 *                                                    `{ data: [...] }` with NO meta
 *   POST   /api/admin/rewards
 *   PUT    /api/admin/rewards/{reward}            (key omitted: it is immutable)
 *   DELETE /api/admin/rewards/{reward}            409 when a cart/order cites it
 *   GET    /api/admin/rewards/redemptions?per_page=100   spent ledger rows
 *   GET    /api/menu                              public; source of menu item
 *                                                    names + image_url for thumbs
 *
 * WHY `/api/menu` IS FETCHED
 * The catalogue eager-loads `menuItem:id,name,slug` — deliberately no
 * `image_url`. RewardThumb's artwork fallback needs the real image, and
 * `GET /api/menu` is the only endpoint that returns it, so the page builds an
 * id -> item map from it.
 *
 * FREE ITEMS ONLY
 * ----------------
 * Vouchers are gone from this page. The API still accepts `type: voucher`
 * (AdminRewardController validates it and PointLedger::definitions() branches
 * on it) and a legacy `voucher-100` row still exists in the catalogue, but it
 * cannot be created or edited here, so it is filtered out entirely rather than
 * shown as a row the admin cannot act on. Every reward this page writes is sent
 * as `type: 'free_item'`.
 *
 * NO MOCK DATA: the catalogue and the redemption ledger both come from the API.
 */

const PER_PAGE = 7

/**
 * Only the fields an admin actually chooses. `key` and `label` are NOT editable:
 * both are derived from the chosen menu item on create (slug -> key, name ->
 * label). Rewards can only be built from an item that already exists in the
 * catalogue, which is also what makes the derived `key` unique — `rewards.key`
 * has a unique index, and menu item slugs are unique, so one reward per item.
 */
interface Draft {
  points_cost: string
  /** Required: every reward is a free item, so the backend rejects null. */
  menu_item_id: string
  is_active: boolean
}

const emptyDraft: Draft = {
  points_cost: '',
  menu_item_id: '',
  is_active: true,
}

function toDraft(reward: Reward): Draft {
  return {
    points_cost: String(reward.points_cost),
    menu_item_id: reward.menu_item_id === null ? '' : String(reward.menu_item_id),
    is_active: reward.is_active,
  }
}

/**
 * What the catalogue shows as the reward's name.
 *
 * `menu_item.name` is the source of truth now that rewards are always free
 * items. `label` is only reached for a legacy row with no menu item — a
 * voucher, say — which the backend still permits even though this page cannot
 * create one.
 */
function rewardName(reward: Reward): string {
  return reward.menu_item?.name ?? reward.label
}

type Tab = 'catalogue' | 'redemptions'

export default function AdminRewardsPage() {
  const [tab, setTab] = useState<Tab>('catalogue')
  const [rewards, setRewards] = useState<Reward[]>([])
  const [ledger, setLedger] = useState<RewardLedgerEntry[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [redemptionSearch, setRedemptionSearch] = useState('')
  const [redemptionPage, setRedemptionPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [editing, setEditing] = useState<Reward | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  // Validation stays quiet until the first save attempt, so an empty "New reward"
  // form does not open covered in errors.
  const [submitted, setSubmitted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  /**
   * The catalogue is small (one row per redeemable reward) and the redemptions
   * endpoint caps at 100, so both are fetched whole and filtered/paged here —
   * same approach as the Orders and Coupons pages. That keeps the search boxes
   * working without a round trip per keystroke.
   *
   * `GET /api/menu` is public, so it needs no token and cannot fail the page on
   * auth; artwork simply falls back to a letter tile if it errors.
   */
  const refresh = useCallback(async () => {
    try {
      const [catalogue, redemptions] = await Promise.all([
        api.get('/admin/rewards'),
        api.get('/admin/rewards/redemptions', { params: { per_page: 100 } }),
      ])

      setRewards(unwrapList<Reward>(catalogue.data).data)
      setLedger(unwrapList<RewardLedgerEntry>(redemptions.data).data)
      setLoadError('')
    } catch (err) {
      setLoadError(fieldError(err).form ?? 'Could not load rewards.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshMenu = useCallback(async () => {
    try {
      const response = await api.get('/menu', { params: { per_page: 100 } })
      setMenuItems(unwrapList<MenuItem>(response.data).data)
    } catch {
      // Artwork is cosmetic: RewardThumb falls back to a letter tile.
    }
  }, [])

  useEffect(() => {
    void refresh()
    void refreshMenu()
  }, [refresh, refreshMenu])

  /** id -> menu item, for names, prices and image_url. */
  const menuById = useMemo(
    () => new Map(menuItems.map((item) => [item.id, item])),
    [menuItems],
  )

  /** reward key -> reward, so a ledger row's reward_key can be labelled. */
  const rewardByKey = useMemo(
    () => new Map(rewards.map((reward) => [reward.key, reward])),
    [rewards],
  )

  /**
   * Menu item ids that are not already rewarded.
   *
   * `rewards.key` is uniquely indexed and a reward's key is derived from its
   * item's slug, so a second reward on the same item would be rejected by the
   * unique index. Filtering here turns that 422 into an option that simply is
   * not offered. While editing, the reward's own item stays selectable.
   */
  const availableItemIds = useMemo(() => {
    // While editing, keep the reward's own item selectable so saving an
    // unchanged item is not blocked by its own row.
    const rewarded = new Set(
      rewards
        .filter((reward) => editing === null || reward.id !== editing.id)
        .map((reward) => reward.menu_item_id)
        .filter((id): id is number => id !== null),
    )

    return new Set(menuItems.map((item) => item.id).filter((id) => !rewarded.has(id)))
  }, [rewards, menuItems, editing])

  /** The menu item the draft is pointed at, if any. Drives the thumb + derived fields. */
  const chosenItem = useMemo(
    () => (draft.menu_item_id === '' ? null : (menuById.get(Number(draft.menu_item_id)) ?? null)),
    [draft.menu_item_id, menuById],
  )

  /**
   * Free items only. The API can still return `type: voucher` rows, but they
   * cannot be created or edited here, so they are left out rather than rendered
   * as rows with dead actions.
   */
  const freeItemRewards = useMemo(
    () => rewards.filter((reward) => reward.type === 'free_item'),
    [rewards],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return freeItemRewards.filter((reward) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? reward.is_active : !reward.is_active)
      const matchesSearch =
        term.length === 0 ||
        rewardName(reward).toLowerCase().includes(term) ||
        reward.key.toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [freeItemRewards, search, statusFilter])

  /**
   * The redemption rows are ledger entries, not issued codes: there is no
   * `status`, `code` or `expires_at` because points are spent instantly at
   * checkout. Searching therefore covers the order number, the customer and the
   * reward label.
   */
  const redemptionRows = useMemo(() => {
    const term = redemptionSearch.trim().toLowerCase()
    if (term.length === 0) return ledger

    return ledger.filter((entry) => {
      const rewardLabel =
        entry.order?.reward_key != null
          ? (rewardByKey.get(entry.order.reward_key)?.label ?? '')
          : ''

      return (
        (entry.order?.order_number ?? '').toLowerCase().includes(term) ||
        (entry.user?.name ?? '').toLowerCase().includes(term) ||
        (entry.user?.email ?? '').toLowerCase().includes(term) ||
        rewardLabel.toLowerCase().includes(term)
      )
    })
  }, [ledger, redemptionSearch, rewardByKey])

  const activeCount = freeItemRewards.filter((reward) => reward.is_active).length

  // The two tables are on separate tabs, so each keeps its own page index.
  const { data: pagedRows, meta } = paginate(
    rows,
    Math.min(page, Math.max(1, Math.ceil(rows.length / PER_PAGE))),
    PER_PAGE,
  )
  const { data: pagedRedemptions, meta: redemptionMeta } = paginate(
    redemptionRows,
    Math.min(
      redemptionPage,
      Math.max(1, Math.ceil(redemptionRows.length / PER_PAGE)),
    ),
    PER_PAGE,
  )

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  function openCreate() {
    setDraft(emptyDraft)
    setFormErrors({})
    setSubmitted(false)
    setCreating(true)
  }

  function openEdit(reward: Reward) {
    setDraft(toDraft(reward))
    setFormErrors({})
    setSubmitted(false)
    setCreating(false)
    setEditing(reward)
  }

  function close() {
    setCreating(false)
    setEditing(null)
    setSubmitted(false)
    setFormErrors({})
  }

  /**
   * Mirrors `AdminRewardController::enforceTypeRequirements` so mistakes surface
   * in the form instead of coming back as a 422. The backend stays the
   * authority; this only saves a round trip.
   */
  const draftErrors = useMemo(() => {
    if (!submitted) return {} as Partial<Record<keyof Draft, string>>

    const errors: Partial<Record<keyof Draft, string>> = {}

    if (!Number.isFinite(Number(draft.points_cost)) || Number(draft.points_cost) < 0) {
      errors.points_cost = 'Must be zero or more.'
    }
    // Every reward is a free item now, so the menu item is always required —
    // AdminRewardController::enforceTypeRequirements rejects a null one, and it
    // is what `key` and `label` are derived from.
    if (draft.menu_item_id === '') {
      errors.menu_item_id = 'Pick the menu item this reward gives away.'
    }

    return errors
  }, [submitted, draft])

  const hasDraftErrors = Object.keys(draftErrors).length > 0

  async function save() {
    setSubmitted(true)
    if (hasDraftErrors) return

    const chosen = draft.menu_item_id === '' ? null : (menuById.get(Number(draft.menu_item_id)) ?? null)

    const payload: Record<string, unknown> = {
      // Derived, not typed. Slug and name come from the menu item, which is why
      // a reward can only be created from an item that already exists.
      label: chosen?.name ?? '',
      // `type` is still required by the API even though the form no longer
      // offers a choice — the only type this page writes is free_item.
      type: 'free_item',
      points_cost: Number(draft.points_cost),
      is_active: draft.is_active,
      menu_item_id: draft.menu_item_id === '' ? null : Number(draft.menu_item_id),
      // Explicitly null so a row can never become a voucher by accident, and so
      // the API never holds a discount the UI has no way to show or edit.
      discount_amount: null,
      min_order_amount: null,
    }

    setSaving(true)
    try {
      if (editing) {
        // `key` is deliberately absent: AdminRewardController@update does not
        // validate it, so sending it would be ignored anyway.
        await api.put(`/admin/rewards/${editing.id}`, payload)
        flash(`${payload.label} updated`)
      } else {
        // The key is the menu item's slug. `rewards.key` is uniquely indexed and
        // menu item slugs are unique, so a second reward on the same item would
        // 422 — which is why the picker only offers items not already rewarded.
        await api.post('/admin/rewards', { ...payload, key: chosen?.slug ?? '' })
        flash(`${payload.label} created`)
      }

      close()
      await refresh()
    } catch (err) {
      const errors = fieldError(err)
      // Backend field errors replace the local ones so the form shows the
      // authoritative message; anything else (409, 403, 500) is a form-level error.
      setFormErrors(
        Object.keys(errors.errors).length > 0
          ? Object.fromEntries(
              Object.entries(errors.errors).map(([key, messages]) => [key, messages[0] ?? '']),
            )
          : { form: errors.form },
      )
      flash(errors.form)
    } finally {
      setSaving(false)
    }
  }

  /**
   * Pause/activate is an ordinary update — the endpoint has no dedicated toggle,
   * so the full payload is resent with the flipped flag.
   */
  async function toggleActive(reward: Reward) {
    const next = !reward.is_active
    try {
      await api.put(`/admin/rewards/${reward.id}`, {
        label: rewardName(reward),
        type: 'free_item',
        points_cost: reward.points_cost,
        is_active: next,
        menu_item_id: reward.menu_item_id,
        discount_amount: null,
        min_order_amount: null,
      })
      flash(`${rewardName(reward)} ${next ? 'activated' : 'paused'}`)
      await refresh()
    } catch (err) {
      flash(fieldError(err).form ?? 'Could not update the reward.')
    }
  }

  async function destroy(reward: Reward) {
    if (!window.confirm(`Delete ${rewardName(reward)}? This cannot be undone.`)) return

    try {
      await api.delete(`/admin/rewards/${reward.id}`)
      flash(`${rewardName(reward)} deleted`)
      await refresh()
    } catch (err) {
      // 409 means a cart or order still cites this key, so the catalogue keeps it.
      flash(fieldError(err).form ?? 'Could not delete the reward.')
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Rewards &amp; Redemption
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {activeCount} active of {freeItemRewards.length} · customers redeem
            points against this catalogue
          </p>
        </div>
        <Button onClick={openCreate}>+ New Reward</Button>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'catalogue', label: 'Catalogue', count: freeItemRewards.length },
          { value: 'redemptions', label: 'Redemptions', count: ledger.length },
        ]}
      />

      {loadError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 ring-inset dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30"
        >
          {loadError}
        </p>
      )}

      {tab === 'catalogue' && (
        <>
          <div className="flex flex-wrap gap-3">
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search label or key…"
              aria-label="Search rewards"
              className="max-w-xs"
            />
            <div className="w-40">
              <Select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as typeof statusFilter)
                  setPage(1)
                }}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </Select>
            </div>
          </div>

          <Card>
            {loading && rewards.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Loading.
              </p>
            ) : (
              <Table
                rows={pagedRows}
                rowKey={(reward) => reward.id}
                empty={
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No rewards match. Adjust the search or status filter.
                  </p>
                }
                columns={[
                  {
                    key: 'label',
                    header: 'Reward',
                    render: (reward: Reward) => (
                      <div className="flex items-center gap-3">
                        <RewardThumb
                          reward={reward}
                          linkedItemImageUrl={
                            reward.menu_item_id === null
                              ? null
                              : (menuById.get(reward.menu_item_id)?.image_url ?? null)
                          }
                        />
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 dark:text-white">
                            {rewardName(reward)}
                          </p>
                          <p className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                            {reward.key}
                          </p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'item',
                    header: 'Gives away',
                    render: (reward: Reward) => {
                      const name =
                        reward.menu_item?.name ??
                        (reward.menu_item_id === null
                          ? null
                          : (menuById.get(reward.menu_item_id)?.name ?? null))

                      return name ? (
                        name
                      ) : (
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          no menu item
                        </span>
                      )
                    },
                  },
                  {
                    key: 'points',
                    header: 'Points',
                    align: 'right',
                    render: (reward: Reward) => (
                      <span className="font-extrabold tabular-nums">
                        {reward.points_cost.toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (reward: Reward) =>
                      reward.is_active ? (
                        <Badge tone="success">Active</Badge>
                      ) : (
                        <Badge tone="neutral">Paused</Badge>
                      ),
                  },
                  {
                    key: 'actions',
                    header: '',
                    align: 'right',
                    render: (reward: Reward) => (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          className="px-2.5 py-1 text-xs"
                          onClick={() => void toggleActive(reward)}
                        >
                          {reward.is_active ? 'Pause' : 'Activate'}
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2.5 py-1 text-xs"
                          onClick={() => openEdit(reward)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2.5 py-1 text-xs"
                          onClick={() => void destroy(reward)}
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
                itemLabel="rewards"
                onPageChange={setPage}
              />
            </div>
          </Card>
        </>
      )}

      {tab === 'redemptions' && (
        <>
          <div className="flex flex-wrap gap-3">
            <Input
              type="search"
              value={redemptionSearch}
              onChange={(event) => {
                setRedemptionSearch(event.target.value)
                setRedemptionPage(1)
              }}
              placeholder="Search order, customer or reward…"
              aria-label="Search redemptions"
              className="max-w-xs"
            />
          </div>

          <Card description="Points are spent the moment an order is placed, so these are ledger rows rather than issued codes — there is nothing for a customer to present and nothing to expire.">
            <Table
              rows={pagedRedemptions}
              rowKey={(entry) => entry.id}
              empty={
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {redemptionSearch.trim() !== ''
                    ? 'No redemptions match the search.'
                    : 'No points have been spent yet.'}
                </p>
              }
              columns={[
                {
                  key: 'order',
                  header: 'Order',
                  render: (entry: RewardLedgerEntry) =>
                    entry.order ? (
                      <span className="font-extrabold tabular-nums">
                        {entry.order.order_number}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    ),
                },
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (entry: RewardLedgerEntry) => (
                    <div>
                      <p className="font-bold">{entry.user?.name ?? '—'}</p>
                      {entry.user?.email && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {entry.user.email}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'reward',
                  header: 'Reward',
                  render: (entry: RewardLedgerEntry) => {
                    const key = entry.order?.reward_key
                    if (!key) return <span className="text-slate-400">—</span>

                    const reward = rewardByKey.get(key)

                    return reward ? (
                      <span className="font-semibold">{rewardName(reward)}</span>
                    ) : (
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {key}
                      </span>
                    )
                  },
                },
                {
                  key: 'spent',
                  header: 'Points',
                  align: 'right',
                  render: (entry: RewardLedgerEntry) => (
                    <span className="font-extrabold tabular-nums text-red-600 dark:text-red-400">
                      −{Math.abs(entry.points_delta).toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: 'balance',
                  header: 'Balance after',
                  align: 'right',
                  render: (entry: RewardLedgerEntry) => (
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      {entry.balance_after.toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: 'date',
                  header: 'Spent',
                  render: (entry: RewardLedgerEntry) => (
                    <span className="text-slate-500 dark:text-slate-400">
                      {formatDate(entry.created_at)}
                    </span>
                  ),
                },
              ]}
            />
            <div className="mt-4">
              <Pagination
                page={redemptionMeta.current_page}
                lastPage={redemptionMeta.last_page}
                total={redemptionMeta.total}
                perPage={redemptionMeta.per_page}
                itemLabel="redemptions"
                onPageChange={setRedemptionPage}
              />
            </div>
          </Card>
        </>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={close}
        title={editing ? `Edit ${editing.label}` : 'New reward'}
        description={
          editing
            ? 'Changes take effect immediately on the customer app.'
            : 'Becomes visible to customers as soon as it is active.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              // Not disabled on an empty form — clicking is what reveals the
              // messages, so a greyed-out button would leave the user stuck.
              disabled={saving || (submitted && hasDraftErrors)}
              onClick={() => void save()}
            >
              {editing ? 'Save Changes' : 'Create Reward'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 ring-inset dark:bg-slate-800/50 dark:ring-slate-700">
            <RewardThumb
              size="lg"
              reward={{
                id: editing?.id ?? 0,
                key: chosenItem?.slug ?? 'new-reward',
                label: chosenItem?.name ?? 'New reward',
                type: 'free_item',
                points_cost: Number(draft.points_cost) || 0,
                menu_item_id: draft.menu_item_id === '' ? null : Number(draft.menu_item_id),
                discount_amount: null,
                min_order_amount: null,
                is_active: draft.is_active,
                created_at: editing?.created_at ?? null,
                updated_at: editing?.updated_at ?? null,
              }}
              linkedItemImageUrl={chosenItem?.image_url ?? null}
            />
            <p className="min-w-0 truncate text-sm font-extrabold text-slate-900 dark:text-white">
              {chosenItem?.name ?? 'New reward'}
            </p>
          </div>

          {formErrors.form && (
            <p
              role="alert"
              className="sm:col-span-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 ring-inset dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30"
            >
              {formErrors.form}
            </p>
          )}

          <div className="sm:col-span-2">
            <Label htmlFor="rw-item" className="mb-1.5">
              Menu item given away
            </Label>
            <Select
              id="rw-item"
              value={draft.menu_item_id}
              disabled={editing !== null}
              onChange={(event) => setDraft({ ...draft, menu_item_id: event.target.value })}
            >
              <option value="">Select a menu item…</option>
              {menuItems
                .filter((item) => item.is_available && availableItemIds.has(item.id))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {peso(item.base_price)}
                  </option>
                  ))}
              </Select>
              {draftErrors.menu_item_id && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {draftErrors.menu_item_id}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="rw-points" className="mb-1.5">
                Points required
              </Label>
              <Input
                id="rw-points"
                type="number"
                min="0"
                value={draft.points_cost}
                onChange={(event) => setDraft({ ...draft, points_cost: event.target.value })}
                placeholder="500"
              />
              {draftErrors.points_cost && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {draftErrors.points_cost}
                </p>
              )}
            </div>

            <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
                className="h-4 w-4 accent-red-600"
              />
              Active
            </label>
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