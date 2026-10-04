import type { AdminUser, User } from '../types'

/**
 * MOCK DATA — stands in for:
 *   GET    /api/admin/users        (?search=, ?page=, ?per_page=)
 *   POST   /api/admin/users
 *   GET    /api/admin/users/{user}
 *   PUT    /api/admin/users/{user}
 *   DELETE /api/admin/users/{user}
 *
 * TODO(next-dev): swap for the real axios calls, e.g.
 *   const { data } = await api.get('/admin/users', { params })
 *   return data.data          // Laravel paginator unwraps to `data`
 *
 * Auth: all routes require a Sanctum token + admin role (EnsureAdmin).
 *
 * NOTE: the backend seeds NO users. The first admin must be promoted by hand
 * (see docs/API_WIRING.md) before /api/admin/users will return anything.
 */

export const mockAdminUsers: AdminUser[] = [
  {
    id: 1,
    name: 'Kevin John Anga',
    email: 'admin@jalikud.test',
    phone: '+63 917 555 0142',
    role: 'admin',
    created_at: '2026-09-15T02:00:00+08:00',
    deleted_at: null,
  },
  {
    id: 2,
    name: 'Ryan Compuesto',
    email: 'ryan@jalikud.test',
    phone: '+63 918 555 0177',
    role: 'admin',
    created_at: '2026-09-15T02:05:00+08:00',
    deleted_at: null,
  },
  {
    id: 3,
    name: 'Charmelle Cahucom',
    email: 'charmelle@jalikud.test',
    phone: '+63 919 555 0163',
    role: 'staff',
    created_at: '2026-09-15T02:10:00+08:00',
    deleted_at: null,
  },
  {
    id: 4,
    name: 'Fletcher Malazarte',
    email: 'fletcher@jalikud.test',
    phone: '+63 920 555 0198',
    role: 'staff',
    created_at: '2026-09-15T02:12:00+08:00',
    deleted_at: null,
  },
  {
    id: 5,
    name: 'Marites Domingo',
    email: 'marites@jalikud.test',
    phone: '+63 917 555 0110',
    role: 'staff',
    created_at: '2026-09-16T09:00:00+08:00',
    deleted_at: null,
  },
  {
    id: 6,
    name: 'Jomar Cruz',
    email: 'jomar@jalikud.test',
    phone: '0919 123 4567',
    role: 'rider',
    created_at: '2026-09-16T10:30:00+08:00',
    deleted_at: null,
  },
  {
    id: 7,
    name: 'Marco Santillan',
    email: 'marco@jalikud.test',
    phone: '0920 111 2233',
    role: 'rider',
    created_at: '2026-09-16T10:35:00+08:00',
    deleted_at: null,
  },
  {
    id: 8,
    name: 'Nilo Ramos',
    email: 'nilo@jalikud.test',
    phone: '0999 555 6677',
    role: 'rider',
    created_at: '2026-09-18T14:20:00+08:00',
    deleted_at: null,
  },
  {
    id: 9,
    name: 'Andrea Buenaventura',
    email: 'andrea@example.com',
    phone: '0917 444 8890',
    role: 'customer',
    created_at: '2026-09-20T11:12:00+08:00',
    deleted_at: null,
  },
  {
    id: 10,
    name: 'Paolo Mendoza',
    email: 'paolo@example.com',
    phone: '0918 222 3344',
    role: 'customer',
    created_at: '2026-09-21T08:45:00+08:00',
    deleted_at: null,
  },
  {
    id: 11,
    name: 'Grace Lim',
    email: 'grace@example.com',
    phone: '0921 333 4455',
    role: 'customer',
    created_at: '2026-09-22T16:20:00+08:00',
    deleted_at: null,
  },
  {
    id: 12,
    name: 'Daniel Oclarit',
    email: 'daniel@example.com',
    phone: '+63 917 555 0121',
    role: 'customer',
    created_at: '2026-09-24T12:00:00+08:00',
    deleted_at: null,
  },
]

/** The signed-in user used by the mock auth session. */
export const mockCurrentUser: User = {
  id: 1,
  name: 'Kevin John Anga',
  email: 'admin@jalikud.test',
  phone: '+63 917 555 0142',
  role: 'admin',
}

export interface Paginated<T> {
  data: T[]
  meta: {
    current_page: number
    per_page: number
    total: number
    last_page: number
  }
}

/** Mirrors Laravel's paginator envelope so the swap is a one-liner. */
export function paginate<T>(rows: T[], page = 1, perPage = 10): Paginated<T> {
  const safePage = Math.max(1, page)
  const start = (safePage - 1) * perPage
  const slice = rows.slice(start, start + perPage)
  return {
    data: slice,
    meta: {
      current_page: safePage,
      per_page: perPage,
      total: rows.length,
      last_page: Math.max(1, Math.ceil(rows.length / perPage)),
    },
  }
}
