import { useMemo, useState } from 'react'
import { peso } from '../mock'
import type { Category, MenuItem } from '../types'
import Button from './ui/Button'
import Input from './ui/Input'
import Label from './ui/Label'
import MenuThumb from './ui/MenuThumb'
import Modal from './ui/Modal'
import Select from './ui/Select'
import Textarea from './ui/Textarea'
import Toggle from './ui/Toggle'

/**
 * Derives a slug from a name: lowercase, URL-safe, capped at 120 characters.
 *
 * Exported because AdminMenuPage needs it too — `menu_items.slug` is equally
 * `required` and `unique` (MenuItemController@store) with no server-side
 * derivation, and its form does not expose the field either.
 *
 * The category column is also `string(120)` (2026_09_15_000004_create_categories_table.php:17).
 *
 * Not a bare `strtolower` — spaces and symbols become hyphens and accents are
 * dropped, because a slug containing them cannot be used in a link.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

export interface CategoryPayload {
  name: string
  slug: string
  description: string | null
  is_active: boolean
}

interface Props {
  /** null = create mode, which hides the item list and the Delete action. */
  category: Category | null
  categories: Category[]
  items: MenuItem[]
  onClose: () => void
  onSave: (payload: CategoryPayload, movingIds: number[], moveTargetId: number | null) => void
  onDelete: (category: Category, movingIds: number[], moveTargetId: number | null) => void
}

/**
 * Add/Edit dialog for a single category.
 *
 * Mounted conditionally by the parent so the initial state can be derived from
 * props in a lazy `useState` instead of reset from an effect — that keeps the
 * form correct when reopened on a different category without a
 * `set-state-in-effect` cascade.
 *
 * `menu_items.category_id` is NOT NULL with `restrictOnDelete()`, so an item can
 * never be left uncategorised. Unchecking an item therefore *moves* it to
 * `moveTargetId` rather than detaching it, and Delete only unlocks once nothing
 * would remain — mirroring the FK the database would otherwise reject with a
 * raw 500 from `CategoryController::destroy()`.
 */
export default function CategoryModal({ category, categories, items, onClose, onSave, onDelete }: Props) {
  const isEdit = category !== null

  const [name, setName] = useState(() => category?.name ?? '')
  const [description, setDescription] = useState(() => category?.description ?? '')
  const [isActive, setIsActive] = useState(() => category?.is_active ?? true)

  const destinations = useMemo(
    () => categories.filter((candidate) => candidate.id !== category?.id),
    [categories, category],
  )
  const [moveTarget, setMoveTarget] = useState(() => String(destinations[0]?.id ?? ''))

  // Ids currently checked. Anything absent will move to `moveTarget` on save.
  const [retained, setRetained] = useState<number[]>(() =>
    items.filter((item) => item.category_id === category?.id).map((item) => item.id),
  )
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const categoryItems = useMemo(
    () => items.filter((item) => item.category_id === category?.id),
    [items, category],
  )
  const movingIds = useMemo(
    () => categoryItems.filter((item) => !retained.includes(item.id)).map((item) => item.id),
    [categoryItems, retained],
  )

  // `categories.slug` is `string(120) UNIQUE` and `CategoryController@store`
  // validates it as 'required' (CategoryController.php:38). Nothing in the
  // backend derives one, so the client must supply a value. It is hidden from
  // the admin because an ordering-system admin has no reason to author or think
  // about web addresses — it is derived from the name instead.
  //
  // Note this is the lowercase-and-URL-safe form of the name, not a bare
  // strtolower: 'Fried Chicken & Wings' must become 'fried-chicken-wings',
  // because a slug containing spaces or '&' would be unusable in a link.
  //
  // Collisions resolve to -2, -3, ... rather than raising an error, for the same
  // reason the field is hidden: a validation message about a field the admin
  // cannot see or correct is not actionable. That matters because the unique
  // index is on slug, not name, so two categories may legitimately share a name.
  const slug = useMemo(() => {
    const base = slugify(name)
    if (!base) return ''
    // The category being edited must be excluded, or saving "Pasta" without
    // renaming it would see its own slug as taken and bump it to "pasta-2" on
    // every no-op edit.
    const taken = new Set(
      categories.filter((candidate) => candidate.id !== category?.id).map((candidate) => candidate.slug),
    )
    if (!taken.has(base)) return base
    for (let suffix = 2; suffix < 1000; suffix++) {
      const candidate = `${base.slice(0, 120 - String(suffix).length - 1)}-${suffix}`
      if (!taken.has(candidate)) return candidate
    }
    return base
  }, [name, categories, category])

  const trimmedName = name.trim()
  // An empty slug only happens when the name contains no letters or digits at
  // all ('!!!', '...'), so the problem is reported against the name rather than
  // against a field that is no longer on screen.
  const nameProblem =
    trimmedName.length === 0
      ? 'A name is required.'
      : trimmedName.length > 100
        ? 'Keep the name to 100 characters or fewer.'
        : slug.length === 0
          ? 'Use at least one letter or number so a web address can be built from it.'
          : null

  const valid = nameProblem === null

  const remaining = categoryItems.length - movingIds.length
  const canDelete = isEdit && remaining === 0
  const noDestination = destinations.length === 0

  function toggleItem(id: number) {
    setRetained((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
    setConfirmingDelete(false)
  }

  function close() {
    onClose()
  }

  return (
    <Modal
      open
      onClose={close}
      size="lg"
      title={isEdit ? `Edit ${category.name}` : 'Add category'}
      description={
        isEdit
          ? 'Rename, reassign the meals inside it, or delete it once nothing is left.'
          : 'Groups menu items into a section of the customer menu.'
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="mr-auto">
            {isEdit &&
              (confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Delete “{category.name}”?
                  </span>
                  <Button
                    variant="secondary"
                    className="px-2.5 py-1.5 text-xs"
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Keep
                  </Button>
                  <Button
                    variant="danger"
                    className="px-2.5 py-1.5 text-xs"
                    onClick={() => onDelete(category, movingIds, moveTarget ? Number(moveTarget) : null)}
                  >
                    Confirm delete
                  </Button>
                </div>
              ) : (
                <Button
                  variant="danger"
                  disabled={!canDelete}
                  title={
                    canDelete
                      ? 'Permanently remove this category'
                      : `${remaining} item${remaining === 1 ? '' : 's'} still in this category — uncheck them to empty it first`
                  }
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete category
                </Button>
              ))}
          </div>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            title={valid ? undefined : 'Fix the highlighted fields first'}
            onClick={() =>
              onSave(
                {
                  name: name.trim(),
                  slug,
                  description: description.trim() === '' ? null : description.trim(),
                  is_active: isActive,
                },
                movingIds,
                moveTarget ? Number(moveTarget) : null,
              )
            }
          >
            {isEdit ? 'Save changes' : 'Create category'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-4">
          <div>
            <Label htmlFor="cat-name" className="mb-1.5">
              Name
            </Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={nameProblem !== null}
              className={nameProblem ? 'border-red-500 dark:border-red-500' : ''}
              placeholder="Chickenjoy"
            />
            <p
              className={`mt-1 text-xs ${
                nameProblem
                  ? 'font-semibold text-red-600 dark:text-red-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {nameProblem ?? 'Up to 100 characters. This is what customers see in the menu.'}
            </p>
          </div>

          <div>
            <Label htmlFor="cat-desc" className="mb-1.5">
              Description
            </Label>
            <Textarea
              id="cat-desc"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Crispy fried chicken, sides and drinks."
            />
          </div>

          <Toggle
            id="cat-active"
            label="Active"
            description="Visible to customers. Turn this off to hide the category without deleting it."
            checked={isActive}
            onChange={setIsActive}
          />
        </div>

        {isEdit && (
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200 ring-inset dark:bg-slate-800/50 dark:ring-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">Meals in this category</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-bold tabular-nums">{remaining}</span> stay
                {movingIds.length > 0 && (
                  <>
                    {' · '}
                    <span className="font-bold tabular-nums">{movingIds.length}</span> will move
                  </>
                )}
              </p>
            </div>

            {noDestination ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 ring-inset dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                This is the only category, so meals cannot be moved elsewhere. Add another category first.
              </p>
            ) : (
              <div className="mt-3">
                <Label htmlFor="cat-move" className="mb-1.5">
                  Move unchecked meals to
                </Label>
                <div className="sm:max-w-xs">
                  <Select
                    id="cat-move"
                    value={moveTarget}
                    onChange={(event) => setMoveTarget(event.target.value)}
                  >
                    {destinations.map((destination) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}

            {categoryItems.length === 0 ? (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 ring-inset dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                Empty — ready to delete.
              </p>
            ) : (
              <ul className="mt-3 max-h-56 divide-y divide-slate-200 overflow-y-auto rounded-lg bg-white ring-1 ring-slate-200 dark:divide-slate-700 dark:bg-slate-900 dark:ring-slate-700">
                {categoryItems.map((item) => {
                  const checked = retained.includes(item.id)
                  return (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(item.id)}
                          className="h-4 w-4 shrink-0 accent-red-600"
                        />
                        <MenuThumb src={item.image_url} name={item.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                            {item.name}
                          </span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                            {item.sku ?? 'No SKU'}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-extrabold tabular-nums text-slate-700 dark:text-slate-200">
                          {peso(item.base_price)}
                        </span>
                        {!checked && (
                          <span className="shrink-0 text-xs font-bold text-amber-600 dark:text-amber-400">
                            → {destinations.find((d) => String(d.id) === moveTarget)?.name ?? '—'}
                          </span>
                        )}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}