import type { Paginated } from '../mock/users'

/**
 * Reads a list response regardless of whether the endpoint wraps its paginator
 * in `{data, meta}` or returns it raw as `{data: {data, current_page, ...}}`.
 *
 * Two shapes exist in this API today:
 *
 *   GET /admin/users   ->  { data: [...], meta: { current_page, ... } }
 *                         (AdminUserController builds the envelope by hand)
 *
 *   GET /menu          ->  { data: { data: [...], current_page, ... } }
 *   GET /categories    ->  (a LengthAwarePaginator already carries its own
 *   GET /admin/coupons ->   `data` key, so wrapping it in ['data' => ...]
 *   GET /admin/orders  ->   nests the rows one level deeper)
 *
 * Backend ticket Task 1 will normalise the second group onto the first. This
 * helper makes the frontend work correctly either way, so wiring a page never
 * depends on which side of that ticket we are on.
 *
 * `meta` is required on the flat shape. A list that omits it cannot be
 * paginated, so defaulting to page 1 of 1 hides a real backend bug behind an
 * empty table; the caller gets a visible 1-page result instead.
 */
export function unwrapList<T>(body: unknown): Paginated<T> {
  const outer = (body as { data: unknown })?.data

  if (Array.isArray(outer)) {
    const flat = body as Paginated<T>
    return flat.meta ? flat : { data: flat.data, meta: singlePageMeta() }
  }

  const nested = outer as {
    data: T[]
    current_page?: number
    per_page?: number
    total?: number
    last_page?: number
  }

  if (!nested || !Array.isArray(nested.data)) {
    return { data: [], meta: singlePageMeta() }
  }

  return {
    data: nested.data,
    meta: {
      current_page: nested.current_page ?? 1,
      per_page: nested.per_page ?? nested.data.length,
      total: nested.total ?? nested.data.length,
      last_page: nested.last_page ?? 1,
    },
  }
}

function singlePageMeta(): Paginated<unknown>['meta'] {
  return { current_page: 1, per_page: 1, total: 0, last_page: 1 }
}
