import { useMemo, useState } from 'react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import Tabs from '../components/ui/Tabs'
import Textarea from '../components/ui/Textarea'
import {
  formatDate,
  mockMenuItems,
  mockRedemptions,
  mockRewards,
  paginate,
  peso,
  rewardItemName,
} from '../mock'
import RewardThumb from '../components/ui/RewardThumb'
import Pagination from '../components/ui/Pagination'
import type { Reward, RewardRedemption, RewardRedemptionStatus, RewardType } from '../types'

/**
 * MOCK-DATA PAGE — stands in for:
 *   GET|POST       /api/admin/rewards
 *   PUT|DELETE     /api/admin/rewards/{reward}
 *   GET            /api/admin/rewards/redemptions
 *
 * ⚠️ NONE OF THOSE ENDPOINTS EXIST. There is no Reward model, no rewards
 *    migration and no route. See docs/API_WIRING.md.
 *
 * The catalogue itself was copied from mobile/src/app/(tabs)/rewards.tsx:24-73
 * so the admin panel and the customer app agree on titles, point costs and
 * cash values. Two inconsistencies between the two apps are documented in
 * mock/rewards.ts and surfaced in the "Broken links" panel below.
 *
 * ADMIN CAPABILITIES: create, edit, enable/disable, delete — mirroring the
 * Menu page. Disable (is_active) is preferred over delete so issued
 * redemptions stay traceable.
 */

interface Draft {
  title: string
  description: string
  type: RewardType
  points_required: string
  monetary_value: string
  menu_item_id: string
  stock: string
  emoji: string
  is_active: boolean
}

const emptyDraft: Draft = {
  title: '',
  description: '',
  type: 'free_item',
  points_required: '',
  monetary_value: '',
  menu_item_id: '',
  stock: '',
  emoji: '',
  is_active: true,
}

function toDraft(reward: Reward): Draft {
  return {
    title: reward.title,
    description: reward.description ?? '',
    // A reward is always a free item now — peso discounts live on Coupons — so a
    // legacy voucher row opens as a free item and asks for its menu item.
    type: 'free_item',
    points_required: String(reward.points_required),
    monetary_value: reward.monetary_value ?? '',
    menu_item_id: reward.menu_item_id === null ? '' : String(reward.menu_item_id),
    stock: reward.stock === null ? '' : String(reward.stock),
    emoji: reward.emoji ?? '',
    is_active: reward.is_active,
  }
}

type Tab = 'catalogue' | 'redemptions'

/** Rows per page in the reward and redemption tables. */
const PER_PAGE = 7

const REDEMPTION_STATUSES: RewardRedemptionStatus[] = ['issued', 'used', 'expired', 'revoked']

const redemptionTone: Record<RewardRedemptionStatus, 'success' | 'info' | 'warning' | 'danger'> = {
  issued: 'info',
  used: 'success',
  expired: 'warning',
  revoked: 'danger',
}

/** Statuses are stored lowercase; the UI shows them capitalised. */
function statusLabel(status: RewardRedemptionStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function AdminRewardsPage() {
  const [tab, setTab] = useState<Tab>('catalogue')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [redemptionPage, setRedemptionPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all')
  const [redemptionSearch, setRedemptionSearch] = useState('')
  const [redemptionStatus, setRedemptionStatus] = useState<'all' | RewardRedemptionStatus>('all')
  const [editing, setEditing] = useState<Reward | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  // Validation stays quiet until the first save attempt, so an empty "New reward"
  // form does not open covered in errors.
  const [submitted, setSubmitted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return mockRewards.filter((reward) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? reward.is_active : !reward.is_active)
      const matchesSearch =
        term.length === 0 || reward.title.toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [search, statusFilter])

  /** Redemptions get their own search + status filter, like the catalogue. */
  const redemptionRows = useMemo(() => {
    const term = redemptionSearch.trim().toLowerCase()
    return mockRedemptions.filter((redemption) => {
      const matchesStatus =
        redemptionStatus === 'all' || redemption.status === redemptionStatus
      const matchesSearch =
        term.length === 0 ||
        redemption.code.toLowerCase().includes(term) ||
        (redemption.user?.name ?? '').toLowerCase().includes(term) ||
        (redemption.user?.email ?? '').toLowerCase().includes(term) ||
        (redemption.reward?.title ?? '').toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [redemptionSearch, redemptionStatus])

  const activeCount = mockRewards.filter((reward) => reward.is_active).length

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
  const totalPoints = mockRewards.reduce((sum, reward) => sum + reward.points_required, 0)
  const avgRatio =
    mockRewards.length > 0
      ? (mockRewards.reduce((sum, r) => sum + Number(r.monetary_value ?? 0), 0) / totalPoints).toFixed(4)
      : '0.0000'

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  function openCreate() {
    setDraft(emptyDraft)
    setSubmitted(false)
    setCreating(true)
  }

  function openEdit(reward: Reward) {
    setDraft(toDraft(reward))
    setSubmitted(false)
    setCreating(false)
    setEditing(reward)
  }

  function close() {
    setCreating(false)
    setEditing(null)
    setSubmitted(false)
  }

  /**
   * Mirrors the backend's eventual validation, so mistakes surface in the form.
   *
   * Nothing is reported until `submitted`: an empty form should look like a form
   * waiting to be filled in, not a list of complaints about itself. The messages
   * appear on the first Create/Save attempt.
   */
  const draftErrors = (() => {
    if (!submitted) return {} as Partial<Record<keyof Draft, string>>

    const errors: Partial<Record<keyof Draft, string>> = {}
    if (!draft.title.trim()) errors.title = 'Title is required.'
    if (!Number.isFinite(Number(draft.points_required)) || Number(draft.points_required) <= 0) {
      errors.points_required = 'Must be a positive number of points.'
    }
    if (draft.monetary_value && Number(draft.monetary_value) < 0) {
      errors.monetary_value = 'Must not be negative.'
    }
    if (draft.stock !== '' && Number(draft.stock) < 0) {
      errors.stock = 'Must not be negative, or blank for unlimited.'
    }
    if (draft.type === 'free_item' && draft.menu_item_id === '') {
      errors.menu_item_id = 'Pick the menu item this reward gives away.'
    }
    return errors
  })()

  const hasDraftErrors = Object.keys(draftErrors).length > 0

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Rewards &amp; Redemption
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {activeCount} active of {mockRewards.length} ·{' '}
            {mockRewards.filter((r) => r.stock !== null).reduce((s, r) => s + (r.stock ?? 0), 0)}{' '}
            units in stock · avg ₱{avgRatio} per point
          </p>
        </div>
        <Button onClick={openCreate}>+ New Reward</Button>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'catalogue', label: 'Catalogue', count: mockRewards.length },
          { value: 'redemptions', label: 'Redemptions', count: mockRedemptions.length },
        ]}
      />

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
              placeholder="Search rewards…"
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
                  key: 'title',
                  header: 'Reward',
                  render: (reward: Reward) => (
                    <div className="flex items-center gap-3">
                      <RewardThumb
                        reward={reward}
                        linkedItemImageUrl={
                          reward.menu_item_id === null
                            ? null
                            : mockMenuItems.find((item) => item.id === reward.menu_item_id)
                                ?.image_url ?? null
                        }
                      />
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-900 dark:text-white">
                          {reward.title}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {reward.description ?? '—'}
                        </p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'type',
                  header: 'Type',
                  render: (reward: Reward) =>
                    reward.type === 'voucher' ? (
                      <Badge tone="info">Voucher</Badge>
                    ) : (
                      <Badge tone="neutral">Free item</Badge>
                    ),
                },
                {
                  key: 'item',
                  header: 'Gives away',
                  render: (reward: Reward) => {
                    const name = rewardItemName(reward)
                    if (reward.type === 'voucher') return <span className="text-slate-400">—</span>
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
                      {reward.points_required.toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: 'value',
                  header: 'Value',
                  align: 'right',
                  render: (reward: Reward) =>
                    reward.monetary_value ? (
                      <span className="tabular-nums">{peso(reward.monetary_value)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    ),
                },
                {
                  key: 'stock',
                  header: 'Stock',
                  align: 'center',
                  render: (reward: Reward) =>
                    reward.stock === null ? (
                      <span className="text-slate-400">∞</span>
                    ) : (
                      <span
                        className={`tabular-nums ${
                          reward.stock === 0
                            ? 'font-bold text-red-600 dark:text-red-400'
                            : reward.stock < 10
                              ? 'font-bold text-amber-600 dark:text-amber-400'
                              : ''
                        }`}
                      >
                        {reward.stock}
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
                        onClick={() =>
                          flash(`${reward.title} ${reward.is_active ? 'paused' : 'activated'}`)
                        }
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
                    </div>
                  ),
                },
              ]}
            />
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
              placeholder="Search code, customer or reward…"
              aria-label="Search redemptions"
              className="max-w-xs"
            />
            <div className="w-40">
              <Select
                aria-label="Filter redemptions by status"
                value={redemptionStatus}
                onChange={(event) => {
                  setRedemptionStatus(event.target.value as typeof redemptionStatus)
                  setRedemptionPage(1)
                }}
              >
                <option value="all">All Status</option>
                {REDEMPTION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Card description="Customers redeem points against this catalogue. Codes are single-use.">
            <Table
              rows={pagedRedemptions}
              rowKey={(redemption) => redemption.id}
              empty={
                redemptionSearch.trim() !== '' || redemptionStatus !== 'all' ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No redemptions match. Adjust the search or status filter.
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">No redemptions yet.</p>
                )
              }
              columns={[
                {
                  key: 'code',
                  header: 'Code',
                render: (redemption: RewardRedemption) => (
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-extrabold tracking-wider text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    {redemption.code}
                  </span>
                ),
              },
              {
                key: 'customer',
                header: 'Customer',
                render: (redemption: RewardRedemption) => (
                  <div>
                    <p className="font-bold">{redemption.user?.name ?? '—'}</p>
                    {redemption.user?.email && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {redemption.user.email}
                      </p>
                    )}
                  </div>
                ),
              },
              {
                key: 'reward',
                header: 'Reward',
                render: (redemption: RewardRedemption) => (
                  <span className="font-semibold">{redemption.reward?.title ?? '—'}</span>
                ),
              },
              {
                key: 'spent',
                header: 'Points',
                align: 'right',
                render: (redemption: RewardRedemption) => (
                  <span className="font-extrabold tabular-nums">
                    −{redemption.points_spent.toLocaleString()}
                  </span>
                ),
              },
              {
                key: 'redeemed',
                header: 'Redeemed',
                render: (redemption: RewardRedemption) => (
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatDate(redemption.redeemed_at)}
                  </span>
                ),
              },
              {
                key: 'expires',
                header: 'Expires',
                render: (redemption: RewardRedemption) => (
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatDate(redemption.expires_at)}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (redemption: RewardRedemption) => (
                  <Badge tone={redemptionTone[redemption.status]}>
                    {statusLabel(redemption.status)}
                  </Badge>
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
        title={editing ? `Edit ${editing.title}` : 'New reward'}
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
              disabled={submitted && hasDraftErrors}
              onClick={() => {
                setSubmitted(true)
                if (hasDraftErrors) return
                flash(editing ? `${editing.title} updated` : `${draft.title || 'Reward'} created`)
                close()
              }}
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
                  title: draft.title || 'New reward',
                  description: draft.description || null,
                  type: draft.type,
                  points_required: Number(draft.points_required) || 0,
                  monetary_value: draft.monetary_value || null,
                  menu_item_id: draft.menu_item_id === '' ? null : Number(draft.menu_item_id),
                  stock: draft.stock === '' ? null : Number(draft.stock),
                  emoji: draft.emoji || null,
                  is_active: draft.is_active,
                  created_at: editing?.created_at ?? null,
                  updated_at: editing?.updated_at ?? null,
                }}
                linkedItemImageUrl={
                  draft.menu_item_id === ''
                    ? null
                    : mockMenuItems.find((item) => item.id === Number(draft.menu_item_id))
                        ?.image_url ?? null
                }
              />
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {draft.title || 'New reward'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {draft.type === 'voucher'
                    ? 'Vouchers have no menu item, so this falls back to the emoji.'
                    : draft.menu_item_id === ''
                      ? 'Pick a menu item and its artwork appears here.'
                      : 'Artwork comes from the linked menu item.'}
                </p>
                <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800 ring-1 ring-amber-200 ring-inset dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                  <span className="font-extrabold">Design-only.</span> Rewards have no image field:
                  there is no <span className="font-semibold">rewards</span> table yet, and neither
                  <span className="font-semibold"> image_url </span> nor
                  <span className="font-semibold"> emoji </span> exist as columns. Artwork is
                  derived from <span className="font-semibold">menu_items.image_url</span>; the
                  emoji is carried over from mobile.
                </p>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="rw-title" className="mb-1.5">
                Title
              </Label>
              <Input
                id="rw-title"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="Free Chickenjoy 1pc"
              />
              {draftErrors.title && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{draftErrors.title}</p>
              )}
            </div>

          <div>
            <Label htmlFor="rw-emoji" className="mb-1.5">
              Emoji <span className="font-normal text-slate-400">(optional)</span>
            </Label>
            <Input
              id="rw-emoji"
              value={draft.emoji}
              onChange={(event) => setDraft({ ...draft, emoji: event.target.value })}
              placeholder="🍗"
              className="text-lg"
            />
          </div>

          {draft.type === 'free_item' && (
            <div className="sm:col-span-2">
              <Label htmlFor="rw-item" className="mb-1.5">
                Menu item given away
              </Label>
              <Select
                id="rw-item"
                value={draft.menu_item_id}
                onChange={(event) => setDraft({ ...draft, menu_item_id: event.target.value })}
              >
                <option value="">Select a menu item…</option>
                {mockMenuItems
                  .filter((item) => item.is_available)
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
          )}

          <div>
            <Label htmlFor="rw-points" className="mb-1.5">
              Points required
            </Label>
            <Input
              id="rw-points"
              type="number"
              min="1"
              value={draft.points_required}
              onChange={(event) => setDraft({ ...draft, points_required: event.target.value })}
              placeholder="500"
            />
            {draftErrors.points_required && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {draftErrors.points_required}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="rw-value" className="mb-1.5">
              Cash value (₱)
            </Label>
            <Input
              id="rw-value"
              type="number"
              min="0"
              step="0.01"
              value={draft.monetary_value}
              onChange={(event) => setDraft({ ...draft, monetary_value: event.target.value })}
              placeholder="109.00"
            />
            {draftErrors.monetary_value && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {draftErrors.monetary_value}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="rw-stock" className="mb-1.5">
              Stock <span className="font-normal text-slate-400">(blank = unlimited)</span>
            </Label>
            <Input
              id="rw-stock"
              type="number"
              min="0"
              value={draft.stock}
              onChange={(event) => setDraft({ ...draft, stock: event.target.value })}
              placeholder="Unlimited"
            />
            {draftErrors.stock && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{draftErrors.stock}</p>
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

          <div className="sm:col-span-2">
            <Label htmlFor="rw-desc" className="mb-1.5">
              Description
            </Label>
            <Textarea
              id="rw-desc"
              rows={2}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="Redeem for a free 1pc Chickenjoy"
            />
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