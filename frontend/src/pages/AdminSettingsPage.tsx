import { useEffect, useState } from 'react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import Toggle from '../components/ui/Toggle'
import api, { fieldError } from '../services/api'
import { formatDateTime, mockStoreSetting, peso } from '../mock'
import type { StoreSetting } from '../types'

/**
 * MOCK-DATA PAGE — stands in for:
 *   GET /api/store-setting        (public)
 *   PUT /api/admin/store-setting  (admin token)
 *
 * TODO(next-dev): replace the mock with api calls, e.g.
 *   const { data } = await api.get('/store-setting')
 *   await api.put('/admin/store-setting', payload)
 *
 * ⚠️ The real endpoint validates its own rules server-side; mirror them in the
 * form. See the Laravel StoreSetting request class on integration day.
 */

type Draft = {
  store_name: string
  is_open: boolean
  accepts_delivery: boolean
  accepts_pickup: boolean
  min_order_amount: string
  delivery_fee: string
  tax_rate_percent: string
  opening_time: string
  closing_time: string
}

function toDraft(setting: StoreSetting): Draft {
  const toTimeInput = (value: string | null) => (value ?? '08:00').slice(0, 5)
  return {
    // StoreSettingController@update marks store_name REQUIRED
    // (backend/app/Http/Controllers/StoreSettingController.php:24), so it has
    // to be part of the submitted payload — not just an uncontrolled input.
    store_name: setting.store_name,
    is_open: setting.is_open,
    accepts_delivery: setting.accepts_delivery,
    accepts_pickup: setting.accepts_pickup,
    min_order_amount: setting.min_order_amount,
    delivery_fee: setting.delivery_fee,
    tax_rate_percent: setting.tax_rate_percent,
    opening_time: toTimeInput(setting.opening_time),
    closing_time: toTimeInput(setting.closing_time),
  }
}

export default function AdminSettingsPage() {
  const [draft, setDraft] = useState<Draft>(() => toDraft(mockStoreSetting))
  const [updatedAt, setUpdatedAt] = useState<string | null>(mockStoreSetting.updated_at)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Seeded from the fixture so the form has a defined shape on first paint,
  // then replaced by GET /store-setting. That endpoint is public (no token), so
  // this resolves even if the session has expired.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await api.get<{ data: StoreSetting }>('/store-setting')
        if (cancelled) return
        if (response.data.data) {
          setDraft(toDraft(response.data.data))
          setUpdatedAt(response.data.data.updated_at)
        }
      } catch {
        if (!cancelled) setError('Could not load store settings. Showing default values.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setSaved(false)
    setFieldErrors((current) => (current[key] ? { ...current, [key]: '' } : current))
  }

  /**
   * PUT /api/admin/store-setting      body: the full draft object
   *
   * StoreSettingController@update (backend/…/StoreSettingController.php:23-33)
   * validates:
   *   store_name       required, string, max:150
   *   is_open          boolean
   *   accepts_delivery boolean
   *   accepts_pickup   boolean
   *   min_order_amount nullable numeric min:0
   *   delivery_fee     nullable numeric min:0
   *   tax_rate_percent nullable numeric min:0
   *   opening_time     nullable date_format:H:i   <- "HH:MM", not "HH:MM:SS"
   *   closing_time     nullable date_format:H:i
   *
   * Note opening_time/closing_time use `date_format:H:i`, so the <input
   * type="time"> values (already HH:MM) are correct as-is -- do not append
   * ":00" or the request 422s.
   *
   * `store_name` is required, so the whole draft is always sent rather than a
   * diff. The controller upserts: it updates the existing row, or creates one if
   * the table is empty.
   */
  async function handleSave() {
    setSaving(true)
    setError('')
    setFieldErrors({})

    try {
      const response = await api.put<{ data: StoreSetting }>('/admin/store-setting', draft)
      setDraft(toDraft(response.data.data))
      setUpdatedAt(response.data.data.updated_at)
      setSaved(true)
    } catch (err) {
      const errors = fieldError(err)
      setFieldErrors(errors)
      setError(errors.form ?? 'Could not save store settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Store settings
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Hours, fees and fulfilment options. Changes apply immediately to the customer app.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <Badge tone="success">Saved</Badge>}
          <Button onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </header>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Store identity" description="Shown in the customer app header.">
          <div className="space-y-4">
            <div>
              <Label htmlFor="st-name" className="mb-1.5">
                Store name
              </Label>
              <Input
                id="st-name"
                value={draft.store_name}
                onChange={(event) => update('store_name', event.target.value)}
                required
                maxLength={150}
                aria-invalid={Boolean(fieldErrors.store_name)}
                className={fieldErrors.store_name ? 'border-red-500 dark:border-red-500' : ''}
              />
              {fieldErrors.store_name && (
                <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  {fieldErrors.store_name}
                </p>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Last updated {formatDateTime(updatedAt)}
            </p>
          </div>
        </Card>

        <Card title="Availability" description="Control what customers can do right now.">
          <div className="space-y-4">
            <Toggle
              id="st-open"
              label="Store is open"
              description="Turn off to pause all new orders temporarily."
              checked={draft.is_open}
              onChange={(value) => update('is_open', value)}
            />
            <Toggle
              id="st-delivery"
              label="Accept delivery orders"
              description="Riders fulfil doorstep deliveries."
              checked={draft.accepts_delivery}
              onChange={(value) => update('accepts_delivery', value)}
              disabled={!draft.is_open}
            />
            <Toggle
              id="st-pickup"
              label="Accept pickup orders"
              description="Customers collect at the counter."
              checked={draft.accepts_pickup}
              onChange={(value) => update('accepts_pickup', value)}
              disabled={!draft.is_open}
            />
          </div>
        </Card>

        <Card title="Opening hours" description="Local store time.">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="st-open-time" className="mb-1.5">
                Opens
              </Label>
              <Input
                id="st-open-time"
                type="time"
                value={draft.opening_time}
                onChange={(event) => update('opening_time', event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="st-close-time" className="mb-1.5">
                Closes
              </Label>
              <Input
                id="st-close-time"
                type="time"
                value={draft.closing_time}
                onChange={(event) => update('closing_time', event.target.value)}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Currently{' '}
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {draft.opening_time} – {draft.closing_time}
            </span>
            .
          </p>
        </Card>

        <Card title="Pricing" description="Applied at checkout.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="st-min" className="mb-1.5">
                Min order (₱)
              </Label>
              <Input
                id="st-min"
                type="number"
                min="0"
                step="0.01"
                value={draft.min_order_amount}
                onChange={(event) => update('min_order_amount', event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="st-fee" className="mb-1.5">
                Delivery fee (₱)
              </Label>
              <Input
                id="st-fee"
                type="number"
                min="0"
                step="0.01"
                value={draft.delivery_fee}
                onChange={(event) => update('delivery_fee', event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="st-tax" className="mb-1.5">
                Tax rate (%)
              </Label>
              <Input
                id="st-tax"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={draft.tax_rate_percent}
                onChange={(event) => update('tax_rate_percent', event.target.value)}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            A {peso('250.00')} order is charged {peso(draft.delivery_fee)} delivery +{' '}
            {peso('250.00')} × {draft.tax_rate_percent || '0'}% tax.
          </p>
        </Card>
      </div>
    </div>
  )
}


