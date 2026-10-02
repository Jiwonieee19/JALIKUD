import { useMemo, useState } from 'react'
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
import { categoryName, mockCategories, mockMenuItems, peso } from '../mock'
import type { MenuItem } from '../types'

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
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    category_id: '1',
    description: '',
    sku: '',
    base_price: '',
    preparation_time_minutes: '10',
  })
  const [toast, setToast] = useState<string | null>(null)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return mockMenuItems.filter((item) => {
      const matchesCategory = categoryFilter === 'all' || item.category_id === Number(categoryFilter)
      const matchesSearch =
        term.length === 0 ||
        item.name.toLowerCase().includes(term) ||
        (item.sku ?? '').toLowerCase().includes(term)
      return matchesCategory && matchesSearch
    })
  }, [search, categoryFilter])

  const soldOut = mockMenuItems.filter((item) => !item.is_available).length

  function flash(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  function openCreate() {
    setDraft({
      name: '',
      category_id: String(mockCategories[0]?.id ?? 1),
      description: '',
      sku: '',
      base_price: '',
      preparation_time_minutes: '10',
    })
    setCreating(true)
  }

  function openEdit(item: MenuItem) {
    setDraft({
      name: item.name,
      category_id: String(item.category_id),
      description: item.description ?? '',
      sku: item.sku ?? '',
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
            {mockMenuItems.length} items across {mockCategories.length} categories ·{' '}
            <span className={soldOut > 0 ? 'font-bold text-red-600 dark:text-red-400' : ''}>
              {soldOut} sold out
            </span>
          </p>
        </div>
        <Button onClick={openCreate}>Add menu item</Button>
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or SKU…"
              aria-label="Search menu items"
              className="max-w-xs"
            />
            <Select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="w-52"
            >
              <option value="all">All categories</option>
              {mockCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
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
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.sku ?? 'No SKU'} · {item.preparation_time_minutes} min
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'category',
                  header: 'Category',
                  render: (item: MenuItem) => categoryName(item.category_id),
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
        </Card>
      ) : (
        <Card>
          <Table
            rows={mockCategories}
            rowKey={(category) => category.id}
            columns={[
              {
                key: 'name',
                header: 'Category',
                render: (category) => (
                  <div>
                    <p className="font-extrabold text-slate-900 dark:text-white">{category.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{category.slug}</p>
                  </div>
                ),
              },
              {
                key: 'count',
                header: 'Items',
                align: 'center',
                render: (category) =>
                  mockMenuItems.filter((item) => item.category_id === category.id).length,
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
                  <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => flash(`Editing ${category.name}`)}>
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
              {mockCategories.map((category) => (
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
