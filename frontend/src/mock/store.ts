import type { Coupon, StoreSetting } from '../types'

/**
 * MOCK DATA — stands in for:
 *   GET    /api/admin/coupons   /  POST /api/admin/coupons
 *   PUT    /api/admin/coupons/{coupon}
 *   DELETE /api/admin/coupons/{coupon}
 *   GET    /api/store-setting   /  PUT  /api/admin/store-setting
 *
 * TODO(next-dev): swap for the real axios calls, e.g.
 *   const { data } = await api.get('/admin/coupons')
 *   await api.put('/admin/store-setting', payload)
 *
 * Auth: store-setting GET is public. Everything else needs an admin token.
 *
 * Note: `value`, `min_order_amount` and `max_discount_amount` are STRINGS —
 * the backend stores these as numeric(12,2) / decimal(10,2).
 */

export const mockCoupons: Coupon[] = [
  {
    id: 1,
    code: 'JALI50',
    type: 'percentage',
    value: '10.00',
    min_order_amount: '200.00',
    max_discount_amount: '100.00',
    usage_limit: 500,
    usage_limit_per_user: 2,
    starts_at: '2026-09-01T00:00:00+08:00',
    expires_at: '2026-12-31T23:59:59+08:00',
    is_active: true,
    created_at: '2026-09-01T00:00:00+08:00',
    updated_at: '2026-09-01T00:00:00+08:00',
  },
  {
    id: 2,
    code: 'WELCOME20',
    type: 'fixed',
    value: '20.00',
    min_order_amount: '150.00',
    max_discount_amount: null,
    usage_limit: 1000,
    usage_limit_per_user: 1,
    starts_at: '2026-09-01T00:00:00+08:00',
    expires_at: '2026-10-31T23:59:59+08:00',
    is_active: true,
    created_at: '2026-09-01T00:00:00+08:00',
    updated_at: '2026-09-01T00:00:00+08:00',
  },
  {
    id: 3,
    code: 'FAMILYBUNDLE',
    type: 'fixed',
    value: '150.00',
    min_order_amount: '700.00',
    max_discount_amount: null,
    usage_limit: 100,
    usage_limit_per_user: 1,
    starts_at: '2026-09-15T00:00:00+08:00',
    expires_at: '2026-10-15T23:59:59+08:00',
    is_active: true,
    created_at: '2026-09-15T00:00:00+08:00',
    updated_at: '2026-09-15T00:00:00+08:00',
  },
  {
    id: 4,
    code: 'GRABDELIVERY',
    type: 'fixed',
    value: '30.00',
    min_order_amount: '100.00',
    max_discount_amount: null,
    usage_limit: null,
    usage_limit_per_user: 3,
    starts_at: '2026-09-10T00:00:00+08:00',
    expires_at: '2026-11-30T23:59:59+08:00',
    is_active: false,
    created_at: '2026-09-10T00:00:00+08:00',
    updated_at: '2026-09-20T00:00:00+08:00',
  },
  {
    id: 5,
    code: 'SCHOOLPROMO',
    type: 'percentage',
    value: '15.00',
    min_order_amount: '300.00',
    max_discount_amount: '120.00',
    usage_limit: 250,
    usage_limit_per_user: 1,
    starts_at: '2026-08-01T00:00:00+08:00',
    expires_at: '2026-09-01T23:59:59+08:00',
    is_active: false,
    created_at: '2026-08-01T00:00:00+08:00',
    updated_at: '2026-09-02T00:00:00+08:00',
  },
]

/** Mirrors the seeded store_settings row from `php artisan db:seed`. */
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
