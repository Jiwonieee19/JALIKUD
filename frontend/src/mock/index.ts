/**
 * Barrel export for the mock layer.
 *
 * WHY THIS EXISTS
 * ---------------
 * The frontend is being built design-first. Every screen is fed from this
 * folder so it renders with NO backend running. Whoever wires the real API
 * should replace the imports in src/pages/* with calls to src/services/api
 * and can then delete this directory.
 *
 * The mapping of mock -> real endpoint lives in docs/API_WIRING.md.
 *
 * ⚠️ Every mock object is typed against src/types.ts, which mirrors the
 * Laravel serialisers. If you change a shape here, change it there too, or
 * the real API will not line up on integration day.
 *
 * Only exports that a page actually consumes live here — if you add one, wire
 * it up or leave it in its own module rather than re-exporting it here.
 */

export { mockAdminUsers, mockCurrentUser, paginate, type Paginated } from './users'
export { mockCategories, mockMenuItems, categoryName, findMenuItem } from './menu'
export { mockOrders, mockRiders } from './orders'
export { mockCoupons, mockStoreSetting } from './store'
export { mockRewards, mockRedemptions, rewardItemName } from './rewards'
export {
  mockOverview,
  mockRecentOrders,
  mockRevenueSeries,
  mockSoldOutItems,
} from './overview'

/** Philippine peso formatting. Use this anywhere money is displayed. */
export function peso(value: string | number): string {
  const amount = typeof value === 'string' ? Number(value) : value
  return amount.toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  })
}

/** "2026-09-29T11:42:00+08:00" -> "29 Sep 2026, 11:42" */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** "2026-09-29T11:42:00+08:00" -> "29 Sep 2026" */
export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
