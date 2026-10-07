import CategoryModal, { slugify, type CategoryPayload } from '../components/CategoryModal'
import Pagination from '../components/ui/Pagination'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import MenuThumb from '../components/ui/MenuThumb'
import Modal from '../components/ui/Modal'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import Textarea from '../components/ui/Textarea'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { paginate, peso } from '../mock'
import api, { fieldError } from '../services/api'
import { unwrapList } from '../services/lists'
import type { Category, MenuItem } from '../types'

/**
 * Rows per page. `GET /api/menu` defaults to `per_page(15)`
 * (MenuItemController.php:23), so pass this as `per_page` on integration —
 * `PaginationRequest` caps it at 100.
 */
const PER_PAGE = 7

const CATEGORY_PER_PAGE = 7

/**
 * Upper bound accepted by PaginationRequest (min:1, max:100).
 *
 * Fetched in one request so the category counts and the client-side search box
 * cover the whole catalogue rather than the first page only. Fine at menu scale;
 * if the catalogue outgrows one request this becomes a server-side search
 * (backend ticket Task 2) plus a real paginator.
 */
const MAX_PER_PAGE = 100

/**
 * Talks to the real API:
 *   GET    /api/menu           ?category_id=&per_page=
 *   GET    /api/categories     ?per_page=
 *   POST   /api/admin/menu-items
 *   PUT    /api/admin/menu-items/{menuItem}
 *   DELETE /api/admin/menu-items/{menuItem}
 *   POST   /api/admin/categories
 *   PUT    /api/admin/categories/{category}
 *   DELETE /api/admin/categories/{category}
 *
 * Both GETs are public; every write needs an admin token.
 *
 * Both list endpoints currently return a raw LengthAwarePaginator, so their rows
 * land at `data.data`. unwrapList() reads either that or the flat
 * `{data, meta}` shape, so this page keeps working after backend ticket Task 1
 * normalises the envelope. See services/lists.ts.
 *
 * KNOWN GAP: GET /api/menu accepts `category_id`, `available` and `featured`
 * but NOT `search`, so the search box filters the fetched page in memory. That
 * is honest rather than faked — once ticket Task 2 adds the param, move the
 * term into the query string and drop the local filter.
 *
 * `DELETE /api/admin/categories/{id}` on a category that still has items is a
 * 500 (restrictOnDelete with no guard) until ticket Task 3. The modal's
 * empty-gate keeps that unreachable from here.
 *
 * Note: money is a decimal(10,2) column on the backend, hence strings.
 */

export default function AdminMenuPage() {
  const [tab, setTab] = useState<'items' | 'categories'>('items')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')
  const [page, setPage] = useState(1)
  const [categoryPage, setCategoryPage] = useState(1)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    category_id: '1',
    description: '',
    sku: '',
    image_url: null as string | null,
    base_price: '',
    preparation_time_minutes: '10',
  })
  const [toast, setToast] = useState<string | null>(null)

  // Categories and items live in component state because the category modal
  // *moves* meals between categories; local state is where that reassignment
  // lands before the list is refetched, so the counts never flicker stale.
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category: Category | null }>({
    open: false,
    category: null,
  })

  function nameOfCategory(id: number): string {
    return categories.find((category) => category.id === id)?.name ?? 'Uncategorised'
  }

  /**
   * Refetches both lists after any write so the table reflects what the
   * database actually holds, rather than trusting optimistic local state.
   */
  const refresh = useCallback(async () => {
    try {
      const [menuResponse, categoryResponse] = await Promise.all([
        api.get('/menu', { params: { per_page: MAX_PER_PAGE } }),
        api.get('/categories', { params: { per_page: MAX_PER_PAGE } }),
      ])

      setItems(unwrapList<MenuItem>(menuResponse.data).data)
      setCategories(unwrapList<Category>(categoryResponse.data).data)
      setLoadError('')
    } catch (err) {
      const errors = fieldError(err)
      setLoadError(errors.form ?? 'Could not load the menu.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchesCategory = categoryFilter === 'all' || item.category_id === Number(categoryFilter)
      const matchesSearch =
        term.length === 0 ||
        item.name.toLowerCase().includes(term) ||
        (item.sku ?? '').toLowerCase().includes(term)
      return matchesCategory && matchesSearch
    })
  }, [items, search, categoryFilter])

  // Pagination is client-side against the fixture, but shaped exactly like
  // Laravel's paginator envelope so wiring GET /menu is a one-line swap:
  // replace paginate(filtered, clamped, PER_PAGE) with the API response and read
  // response.data / response.meta. See mock/users.ts -> paginate().
  //
  // `clamped` guards a real failure mode: paginate() floors page at 1 but does
  // not cap it, so page 2 of a 1-page set returns zero rows. Unreachable today
  // (Next is disabled at the last page and filters reset to 1), but one guard
  // away from a blank table if either is changed.
  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const clamped = Math.min(page, lastPage)
  const { data: rows, meta } = paginate(filtered, clamped, PER_PAGE)

  // Categories get their own pager; the two tabs are never on screen at once.
  const { data: categoryRows, meta: categoryMeta } = paginate(
    categories,
    Math.min(categoryPage, Math.max(1, Math.ceil(categories.length / CATEGORY_PER_PAGE))),
    CATEGORY_PER_PAGE,
  )

  const soldOut = items.filter((item) => !item.is_available).length

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  /**
   * Reassigns meals in one request each.
   *
   * `menu_items.category_id` is NOT NULL, so an item can never be left
   * uncategorised — this always supplies a concrete destination. Each is a
   * separate PUT because the endpoint takes one menu item at a time; they are
   * issued together with Promise.all so the modal does not wait on a chain.
   */
  async function applyMoves(movingIds: number[], moveTargetId: number | null) {
    if (movingIds.length === 0 || moveTargetId === null) return

    await Promise.all(
      movingIds.map((id) =>
        api.put(`/admin/menu-items/${id}`, { category_id: moveTargetId }),
      ),
    )

    // Reflect the move locally so the modal's remaining count stays correct
    // before the refetch lands.
    setItems((current) =>
      current.map((item) => (movingIds.includes(item.id) ? { ...item, category_id: moveTargetId } : item)),
    )
  }

  function openCreate() {
    setDraft({
      name: '',
      category_id: String(categories[0]?.id ?? 1),
      description: '',
      sku: '',
      image_url: null,
      base_price: '',
      preparation_time_minutes: '10',
    })
    setFormErrors({})
    setCreating(true)
  }

  function openCreateCategory() {
    setCategoryModal({ open: true, category: null })
  }

  function openEditCategory(category: Category) {
    setCategoryModal({ open: true, category })
  }

  function closeCategoryModal() {
    setCategoryModal({ open: false, category: null })
  }

  /**
   * POST /api/admin/categories when creating, PUT when editing.
   *
   * `slug` is not editable in the modal — the API requires it and derives
   * nothing, so the modal computes it from the name and disambiguates
   * collisions itself. See components/CategoryModal.tsx.
   *
   * `sort_order` is preserved on edit (the modal no longer exposes it, so an
   * absent key must not clobber the stored value) and appended as max+1 on
   * create, which matches CategoryController@index's `orderBy('sort_order')`.
   */
  async function saveCategory(
    payload: CategoryPayload,
    movingIds: number[],
    moveTargetId: number | null,
  ) {
    const target = categoryModal.category
    setSaving(true)

    try {
      if (target) {
        await applyMoves(movingIds, moveTargetId)
        await api.put(`/admin/categories/${target.id}`, payload)
      } else {
        const nextSortOrder = categories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1
        await api.post('/admin/categories', { ...payload, sort_order: nextSortOrder })
      }

      await refresh()
      closeCategoryModal()

      const moved = movingIds.length
      flash(
        target && moved > 0
          ? `${payload.name} updated · ${moved} meal${moved === 1 ? '' : 's'} moved to ${nameOfCategory(moveTargetId!)}`
          : target
            ? `${payload.name} updated`
            : `${payload.name} created`,
      )
    } catch (err) {
      const errors = fieldError(err)
      flash(errors.form ?? Object.values(errors)[0] ?? 'Could not save the category.')
    } finally {
      setSaving(false)
    }
  }

  /**
   * DELETE /api/admin/categories/{id}, with any pending meal moves applied first
   * so "uncheck everything, then delete" does not discard the reassignment the
   * admin just made in the same dialog.
   *
   * The backend still answers 500 here if anything references the category
   * (restrictOnDelete with no guard) — see ticket Task 3. The modal only
   * enables Delete at zero items, so that path is unreachable from this UI.
   */
  async function deleteCategory(
    category: Category,
    movingIds: number[],
    moveTargetId: number | null,
  ) {
    setSaving(true)

    try {
      await applyMoves(movingIds, moveTargetId)
      await api.delete(`/admin/categories/${category.id}`)
      await refresh()
      closeCategoryModal()
      flash(`${category.name} deleted`)
    } catch (err) {
      const errors = fieldError(err)
      flash(errors.form ?? Object.values(errors)[0] ?? 'Could not delete the category.')
    } finally {
      setSaving(false)
    }
  }

  /**
   * POST /api/admin/menu-items when creating, PUT /{id} when editing.
   *
   * `slug` is required and unique on MenuItemController but is not part of this
   * form, so it is derived from the name the same way the category modal does.
   */
  async function saveItem() {
    setSaving(true)
    setFormErrors({})

    const name = draft.name.trim()
    const slug = slugify(name)

    if (!name || !slug) {
      setFormErrors({ name: 'Enter a name using at least one letter or number.' })
      setSaving(false)
      return
    }

    const localErrors: Record<string, string> = {}

    if (name.length > 150) {
      localErrors.name = 'Keep the name to 150 characters or fewer.'
    }

    // base_price is required and min:0 server-side; an empty field would send
    // NaN and 422 on the round-trip instead of being caught here.
    if (draft.base_price.trim() === '') {
      localErrors.base_price = 'Enter a base price.'
    } else if (!Number.isFinite(Number(draft.base_price)) || Number(draft.base_price) < 0) {
      localErrors.base_price = 'Must not be negative.'
    }

    if (draft.sku.trim().length > 50) {
      localErrors.sku = 'Keep the SKU to 50 characters or fewer.'
    }

    const prep = Number(draft.preparation_time_minutes)
    if (!Number.isInteger(prep) || prep < 0) {
      localErrors.preparation_time_minutes = 'Must be zero or more whole minutes.'
    }

    if (Object.keys(localErrors).length > 0) {
      setFormErrors(localErrors)
      setSaving(false)
      return
    }

    const payload = {
      name,
      slug,
      category_id: Number(draft.category_id),
      description: draft.description.trim() === '' ? null : draft.description.trim(),
      sku: draft.sku.trim() === '' ? null : draft.sku.trim(),
      // base_price is `required` on MenuItemController (line 43) and prep time
      // is `nullable, integer, min:0` — so 0 is a valid prep time, not an error.
      base_price: Number(draft.base_price),
      preparation_time_minutes: Number(draft.preparation_time_minutes),
      ...(draft.image_url ? { image_url: draft.image_url } : {}),
    }

    try {
      if (editing) {
        await api.put(`/admin/menu-items/${editing.id}`, payload)
      } else {
        await api.post('/admin/menu-items', payload)
      }

      await refresh()
      setCreating(false)
      setEditing(null)
      flash(editing ? `${payload.name} updated` : `${payload.name} created`)
    } catch (err) {
      const errors = fieldError(err)
      setFormErrors(errors)
      flash(errors.form ?? Object.values(errors)[0] ?? 'Could not save the item.')
    } finally {
      setSaving(false)
    }
  }

  /** PUT /api/admin/menu-items/{id} { is_available } — the sold-out toggle. */
  async function toggleAvailability(item: MenuItem) {
    const next = !item.is_available

    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, is_available: next } : candidate,
      ),
    )

    try {
      await api.put(`/admin/menu-items/${item.id}`, { is_available: next })
      flash(`${item.name} marked ${next ? 'available' : 'sold out'}`)
    } catch (err) {
      // Roll the optimistic flip back so the table never disagrees with the API.
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? { ...candidate, is_available: item.is_available } : candidate,
        ),
      )
      const errors = fieldError(err)
      flash(errors.form ?? Object.values(errors)[0] ?? 'Could not update availability.')
    }
  }

  function openEdit(item: MenuItem) {
    setDraft({
      name: item.name,
      category_id: String(item.category_id),
      description: item.description ?? '',
      sku: item.sku ?? '',
      image_url: item.image_url,
      base_price: item.base_price,
      preparation_time_minutes: String(item.preparation_time_minutes),
    })
    setFormErrors({})
    setEditing(item)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Menu</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {items.length} items across {categories.length} categories ·{' '}
            <span className={soldOut > 0 ? 'font-bold text-red-600 dark:text-red-400' : ''}>
              {soldOut} sold out
            </span>
          </p>
        </div>
        {tab === 'items' ? (
          <Button onClick={openCreate} disabled={loading || categories.length === 0}>
            Add menu item
          </Button>
        ) : (
          <Button onClick={openCreateCategory}>Add category</Button>
        )}
      </header>

      {loadError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {loadError}
        </p>
      )}

      {tab === 'items' && categories.length === 0 && !loading && (
        <Card>
          <EmptyState
            title="Add a category first"
            description="Every menu item belongs to a category, so create one before adding items."
          />
          <div className="mt-4 flex justify-center">
            <Button
              onClick={() => {
                setTab('categories')
                openCreateCategory()
              }}
            >
              Add category
            </Button>
          </div>
        </Card>
      )}

      {tab === 'categories' && categories.length === 0 && !loading && !loadError && (
        <Card>
          <EmptyState
            title="No categories yet"
            description="Categories group the menu into sections customers browse."
          />
        </Card>
      )}

      <div className="flex gap-2">
        {(['items', 'categories'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition-colors ${
              tab === value
                ? 'bg-red-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-slate-800'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === 'items' ? (
        <Card>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search name or SKU…"
              aria-label="Search menu items"
              className="max-w-xs"
            />
            <div className="w-52">
              <Select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value)
                  setPage(1)
                }}
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
            <p className="ml-auto self-center text-sm text-slate-500 dark:text-slate-400">
              Showing <span className="font-bold tabular-nums">{rows.length}</span> of{' '}
              <span className="font-bold tabular-nums">{filtered.length}</span> item
              {filtered.length === 1 ? '' : 's'}
            </p>
          </div>

          {rows.length === 0 ? (
            <EmptyState title="No items match" description="Adjust the search or category filter." />
          ) : (
            <Table
              rows={rows}
              rowKey={(item) => item.id}
              columns={[
                {
                  key: 'name',
                  header: 'Item',
                  render: (item: MenuItem) => (
                    <div className="flex items-center gap-3">
                      <MenuThumb src={item.image_url} name={item.name} />
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-900 dark:text-white">{item.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.sku ?? 'No SKU'} · {item.preparation_time_minutes} min
                        </p>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'category',
                  header: 'Category',
                  render: (item: MenuItem) => nameOfCategory(item.category_id),
                },
                {
                  key: 'price',
                  header: 'Price',
                  align: 'right',
                  className: 'pr-[212px]',
                  render: (item: MenuItem) => (
                    <span className="font-extrabold tabular-nums">{peso(item.base_price)}</span>
                  ),
                },
                {
                  key: 'availability',
                  header: 'Availability',
                  render: (item: MenuItem) =>
                    item.is_available ? <Badge tone="success">Available</Badge> : <Badge tone="danger">Sold out</Badge>,
                },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  render: (item: MenuItem) => (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="px-2.5 py-1 text-xs"
                        onClick={() => void toggleAvailability(item)}
                      >
                        {item.is_available ? 'Sold out' : 'Restore'}
                      </Button>
                      <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => openEdit(item)}>
                        Edit
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
              itemLabel="items"
              onPageChange={setPage}
            />
          </div>
        </Card>
      ) : (
        <Card>
          <Table
            rows={categoryRows}
            rowKey={(category) => category.id}
            columns={[
              {
                  key: 'name',
                  header: 'Category',
                  render: (category) => (
                    <div className="flex items-center gap-3">
                      <MenuThumb src={category.image_url} name={category.name} size="sm" />
                      <p className="min-w-0 truncate font-extrabold text-slate-900 dark:text-white">
                        {category.name}
                      </p>
                    </div>
                  ),
                },
              {
                key: 'count',
                header: 'Items',
                align: 'center',
                render: (category) => items.filter((item) => item.category_id === category.id).length,
              },
              {
                key: 'order',
                header: 'Sort order',
                align: 'center',
                render: (category) => category.sort_order,
              },
              {
                key: 'status',
                header: 'Status',
                render: (category) =>
                  category.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Hidden</Badge>,
              },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (category) => (
                  <Button
                    variant="ghost"
                    className="px-2.5 py-1 text-xs"
                    onClick={() => openEditCategory(category)}
                  >
                    Edit
                  </Button>
                ),
              },
            ]}
          />
          <div className="mt-4">
            <Pagination
              page={categoryMeta.current_page}
              lastPage={categoryMeta.last_page}
              total={categoryMeta.total}
              perPage={categoryMeta.per_page}
              itemLabel="categories"
              onPageChange={setCategoryPage}
            />
          </div>
        </Card>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false)
          setEditing(null)
        }}
        title={editing ? `Edit ${editing.name}` : 'Add menu item'}
        description={
          editing ? 'Changes go live on the customer app immediately.' : 'The item appears in the menu once saved.'
        }
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
            <Button onClick={() => void saveItem()} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create item'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
<div className="sm:col-span-2 flex items-center gap-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 ring-inset dark:bg-slate-800/50 dark:ring-slate-700">
              <MenuThumb
                src={
                  draft.image_url ||
                  (draft.name
                    ? `/images/menu/${draft.name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '')}.svg`
                    : null)
                }
                name={draft.name || 'New item'}
                size="lg"
              />
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {draft.name || 'New menu item'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Preview from the generated placeholders. The API has no image field yet —
                  <span className="font-semibold"> menu_items.image_url </span>
                  exists in the schema but no endpoint populates it.
                </p>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="mi-name" className="mb-1.5">
                Name
              </Label>
              <Input
                id="mi-name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Chickenjoy 1pc"
                required
                aria-invalid={Boolean(formErrors.name)}
                className={formErrors.name ? 'border-red-500 dark:border-red-500' : ''}
              />
              <p
                className={`mt-1 text-xs ${
                  formErrors.name
                    ? 'font-semibold text-red-600 dark:text-red-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {formErrors.name ?? 'Up to 150 characters. This is what customers see in the menu.'}
              </p>
            </div>
          <div>
            <Label htmlFor="mi-category" className="mb-1.5">
              Category
            </Label>
            <Select
              id="mi-category"
              value={draft.category_id}
              onChange={(event) => setDraft({ ...draft, category_id: event.target.value })}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="mi-sku" className="mb-1.5">
              SKU
            </Label>
            <Input
              id="mi-sku"
value={draft.sku}
                onChange={(event) => setDraft({ ...draft, sku: event.target.value })}
                placeholder="CJ-001"
                maxLength={50}
                aria-invalid={Boolean(formErrors.sku)}
                className={formErrors.sku ? 'border-red-500 dark:border-red-500' : ''}
              />
              {formErrors.sku && (
                <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  {formErrors.sku}
                </p>
              )}
            </div>
          <div>
            <Label htmlFor="mi-price" className="mb-1.5">
              Base price (₱)
            </Label>
            <Input
              id="mi-price"
              type="number"
              min="0"
              step="0.01"
value={draft.base_price}
                onChange={(event) => setDraft({ ...draft, base_price: event.target.value })}
                placeholder="109.00"
                aria-invalid={Boolean(formErrors.base_price)}
                className={formErrors.base_price ? 'border-red-500 dark:border-red-500' : ''}
              />
              {formErrors.base_price && (
                <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  {formErrors.base_price}
                </p>
              )}
            </div>
          <div>
            <Label htmlFor="mi-prep" className="mb-1.5">
              Prep time (minutes)
            </Label>
            <Input
id="mi-prep"
                type="number"
                min="0"
value={draft.preparation_time_minutes}
                onChange={(event) => setDraft({ ...draft, preparation_time_minutes: event.target.value })}
                aria-invalid={Boolean(formErrors.preparation_time_minutes)}
                className={
                  formErrors.preparation_time_minutes ? 'border-red-500 dark:border-red-500' : ''
                }
              />
              {formErrors.preparation_time_minutes && (
                <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  {formErrors.preparation_time_minutes}
                </p>
              )}
            </div>
          <div className="sm:col-span-2">
            <Label htmlFor="mi-desc" className="mb-1.5">
              Description
            </Label>
            <Textarea
              id="mi-desc"
              rows={3}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="One piece of our signature fried chicken with garlic dip."
            />
          </div>
        </div>
      </Modal>

      {categoryModal.open && (
        <CategoryModal
          category={categoryModal.category}
          categories={categories}
          items={items}
          onClose={closeCategoryModal}
          onSave={saveCategory}
          onDelete={deleteCategory}
        />
      )}

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
