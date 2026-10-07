import type { StoreSetting } from '../types'

/**
 * Placeholder store settings, used only as the initial form state on
 * AdminSettingsPage so the inputs have a defined shape before the first paint.
 * That page replaces it with the real row from GET /api/store-setting, which is
 * a public endpoint, so the form is correct by the time anyone can edit it.
 *
 *   GET /api/store-setting   (public)
 *   PUT /api/admin/store-setting   (admin token)
 *
 * The coupon fixtures that used to live here were removed once AdminCouponsPage
 * was wired to the real endpoint.
 *
 * Note: money fields are STRINGS — the backend stores them as decimal(10,2).
 */

export const mockStoreSetting: StoreSetting = {
  id: 1,
  store_name: 'JALIKUD',
  is_open: true,
  accepts_delivery: true,
  accepts_pickup: true,
  min_order_amount: '0.00',
  delivery_fee: '49.00',
  tax_rate_percent: '0.00',
  opening_time: '08:00:00',
  closing_time: '22:00:00',
  updated_at: '2026-09-29T07:00:00+08:00',
}
