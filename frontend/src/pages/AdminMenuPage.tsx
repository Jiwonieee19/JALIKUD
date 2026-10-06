import { useMemo, useState } from 'react'
import CategoryModal, { type CategoryPayload } from '../components/CategoryModal'
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
import { mockCategories, mockMenuItems, paginate, peso } from '../mock'
import type { Category, MenuItem } from '../types'

/**
 * Rows per page. `GET /api/menu` defaults to `per_page(15)`
 * (MenuItemController.php:23), so pass this as `per_page` on integration —
 * `PaginationRequest` caps it at 100.
 */
const PER_PAGE = 10

/**
 * MOCK-DATA PAGE — stands in for:
 *   GET  /api/menu
 *   GET  /api/categories
 *   POST|PUT|PATCH|DELETE /api/admin/menu-items[/{menu_item}]
 *   POST|PUT|PATCH|DELETE /api/admin/categories[/{category}]
 *
 * TODO(next-dev): replace the mock imports with api calls, e.g.
 *   const { data } = await api.get('/menu')
 *   await api.put(`/admin/menu-items/${id}`, payload)
 *
 * Auth: the two GETs are public. All writes require an admin token.
 *
 * Note: money is a decimal(10,2) column on the backend, hence strings.
 */

export default function AdminMenuPage() {
  const [tab, setTab] = useState<'items' | 'categories'>('items')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')
  const [page, setPage] = useState(1)
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

  // Categories and items are held in component state rather than read straight
  // from the fixture, because the category modal can now *move* meals between
  // categories. Without local state the reassignment has nowhere to land and
  // every count on the page would still read the unedited mock. The mock
  // modules stay as the seed values; `categoryName()` from mock/menu.ts is no
  // longer used since it also resolves against the fixture and would ignore a
  // rename.
  const [categories, setCategories] = useState<Category[]>(mockCategories)
  const [items, setItems] = useState<MenuItem[]>(mockMenuItems)

  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category: Category | null }>({
    open: false,
    category: null,
  })

  function nameOfCategory(id: number): string {
    return categories.find((category) => category.id === id)?.name ?? 'Uncategorised'
  }

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

  const soldOut = items.filter((item) => !item.is_available).length

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  function applyMoves(movingIds: number[], moveTargetId: number | null) {
    if (movingIds.length === 0 || moveTargetId === null) return
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

  function saveCategory(payload: CategoryPayload, movingIds: number[], moveTargetId: number | null) {
    const target = categoryModal.category

    applyMoves(movingIds, moveTargetId)

    if (target) {
      // sort_order is preserved on edit: the modal no longer exposes it, so it
      // must not be clobbered by an absent key.
      setCategories((current) =>
        current.map((category) => (category.id === target.id ? { ...category, ...payload } : category)),
      )
      const moved = movingIds.length
      flash(
        moved > 0
          ? `${payload.name} updated · ${moved} meal${moved === 1 ? '' : 's'} moved to ${nameOfCategory(moveTargetId!)}`
          : `${payload.name} updated`,
      )
    } else {
      const nextId = categories.reduce((max, category) => Math.max(max, category.id), 0) + 1
      const nextSortOrder = categories.reduce((max, category) => Math.max(max, category.sort_order), 0) + 1
      setCategories((current) => [
        ...current,
        {
          id: nextId,
          parent_id: null,
          created_at: null,
          updated_at: null,
          image_url: null,
          sort_order: nextSortOrder,
          ...payload,
        },
      ])
      flash(`${payload.name} created`)
    }

    closeCategoryModal()
  }

  function deleteCategory(category: Category, movingIds: number[], moveTargetId: number | null) {
    // Moves are applied in the same action so "uncheck everything, then delete"
    // does not silently discard the reassignment the admin just made.
    applyMoves(movingIds, moveTargetId)
    setCategories((current) => current.filter((candidate) => candidate.id !== category.id))
    flash(`${category.name} deleted`)
    closeCategoryModal()
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
          <Button onClick={openCreate}>Add menu item</Button>
        ) : (
          <Button onClick={openCreateCategory}>Add category</Button>
        )}
      </header>

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
                  render: (item: MenuItem) => (
                    <span className="font-extrabold tabular-nums">{peso(item.base_price)}</span>
                  ),
                },
                {
                  key: 'featured',
                  header: 'Featured',
                  align: 'center',
                  render: (item: MenuItem) =>
                    item.is_featured ? <Badge tone="brand">★</Badge> : <span className="text-slate-400">—</span>,
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
                        onClick={() => flash(`${item.name} marked ${item.is_available ? 'sold out' : 'available'}`)}
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

          {meta.last_page > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>
                Page {meta.current_page} of {meta.last_page}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={meta.current_page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={meta.current_page >= meta.last_page}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <Table
            rows={categories}
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
            <Button
              onClick={() => {
                flash(editing ? `${editing.name} updated` : `${draft.name || 'Item'} created`)
                setCreating(false)
                setEditing(null)
              }}
            >
              {editing ? 'Save changes' : 'Create item'}
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
              />
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
            />
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
            />
          </div>
          <div>
            <Label htmlFor="mi-prep" className="mb-1.5">
              Prep time (minutes)
            </Label>
            <Input
              id="mi-prep"
              type="number"
              min="1"
              value={draft.preparation_time_minutes}
              onChange={(event) => setDraft({ ...draft, preparation_time_minutes: event.target.value })}
            />
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
