import { mockAdminUsers, paginate, type Paginated } from './users'
import type { AdminUser, UserRole } from '../types'

/**
 * MOCK API — drop-in replacement for the four AdminUsersPage calls.
 *
 * Stands in for:
 *   GET    /api/admin/users   (?search=, ?page=)
 *   POST   /api/admin/users
 *   PUT    /api/admin/users/{user}
 *   DELETE /api/admin/users/{user}
 *
 * TODO(next-dev): delete this file and restore the `api` calls in
 * AdminUsersPage.tsx. The payloads below match the Laravel controllers
 * exactly, so the swap is mechanical:
 *
 *   import api from '../services/api'
 *   type ListResponse = { data: AdminUser[]; meta: {...} }
 *   const response = await api.get<ListResponse>('/admin/users', {
 *     params: { search: search || undefined, page },
 *   })
 *   await api.put(`/admin/users/${editing.id}`, payload)
 *   await api.post('/admin/users', form)
 *   await api.delete(`/admin/users/${user.id}`)
 *
 * Validation below mirrors the backend request classes:
 *   StoreUserRequest / UpdateUserRequest
 *   - name required, min 2, max 255
 *   - email required, valid, unique across users
 *   - phone optional, max 30
 *   - password StrongPassword when creating; optional on update
 *   - role must be one of customer|staff|admin|rider
 *
 * Auth: every route requires a Sanctum token + admin role (EnsureAdmin).
 * Laravel returns 422 with { message, errors: { field: [msg] } } on failure.
 */

export interface UserQuery {
  search?: string
  role?: UserRole
  page?: number
  per_page?: number
}

export interface UserPayload {
  name: string
  email: string
  phone?: string | null
  password?: string
  role: UserRole
}

type FieldErrors = Record<string, string[]>

/** Mimics an axios rejection so the page's existing 422 handling works. */
function fail(status: number, message: string, errors?: FieldErrors): never {
  throw { response: { status, data: { message, ...(errors ? { errors } : {}) } } }
}

const LATENCY_MS = 220

const wait = (ms = LATENCY_MS) => new Promise((resolve) => setTimeout(resolve, ms))

/** Mirrors App\Rules\StrongPassword. */
const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

function validate(payload: UserPayload, editingId: number | null): FieldErrors {
  const errors: FieldErrors = {}

  if (!payload.name || payload.name.trim().length < 2) {
    errors.name = ['Please provide a valid name.']
  } else if (payload.name.length > 255) {
    errors.name = ['The name may not be greater than 255 characters.']
  }

  const email = payload.email?.trim() ?? ''
  if (!email) {
    errors.email = ['Please provide an email address.']
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = ['Please provide a valid email address.']
  } else {
    const clash = mockAdminUsers.some(
      (user) => user.email.toLowerCase() === email.toLowerCase() && user.id !== editingId,
    )
    if (clash) errors.email = ['An account with this email already exists.']
  }

  if (payload.phone && payload.phone.length > 30) {
    errors.phone = ['The phone number must not exceed 30 characters.']
  }

  if (!editingId && payload.password && !STRONG.test(payload.password)) {
    errors.password = [
      'The password must be at least 8 characters and include an uppercase letter and a digit.',
    ]
  }

  if (!['customer', 'staff', 'admin', 'rider'].includes(payload.role)) {
    errors.role = ['The selected role is invalid.']
  }

  return errors
}

export const mockAdminUsersApi = {
  async list(query: UserQuery = {}): Promise<Paginated<AdminUser>> {
    await wait()
    const term = query.search?.trim().toLowerCase() ?? ''
    let rows = mockAdminUsers.filter((user) => !user.deleted_at)

    if (term) {
      rows = rows.filter(
        (user) =>
          user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term),
      )
    }
    if (query.role) {
      rows = rows.filter((user) => user.role === query.role)
    }

    return paginate(rows, query.page ?? 1, query.per_page ?? 10)
  },

  async store(payload: UserPayload): Promise<AdminUser> {
    await wait()
    const errors = validate(payload, null)
    if (Object.keys(errors).length > 0) {
      fail(422, 'The given data was invalid.', errors)
    }
    const created: AdminUser = {
      id: Math.max(...mockAdminUsers.map((user) => user.id)) + 1,
      name: payload.name.trim(),
      email: payload.email.trim(),
      phone: payload.phone || null,
      role: payload.role,
      created_at: new Date().toISOString(),
      deleted_at: null,
    }
    mockAdminUsers.unshift(created)
    return created
  },

  async update(id: number, payload: UserPayload): Promise<AdminUser> {
    await wait()
    const existing = mockAdminUsers.find((user) => user.id === id)
    if (!existing) fail(404, 'User not found.')
    // AdminUserController blocks an admin from changing their own role.
    if (existing.role === 'admin' && payload.role !== 'admin') {
      fail(422, 'The given data was invalid.', {
        role: ['You cannot change your own role.'],
      })
    }
    const errors = validate(payload, id)
    if (Object.keys(errors).length > 0) {
      fail(422, 'The given data was invalid.', errors)
    }
    Object.assign(existing, {
      name: payload.name.trim(),
      email: payload.email.trim(),
      phone: payload.phone || null,
      role: payload.role,
    })
    return existing
  },

  async destroy(id: number): Promise<void> {
    await wait()
    const existing = mockAdminUsers.find((user) => user.id === id)
    if (!existing) fail(404, 'User not found.')
    if (existing.role === 'admin') {
      fail(422, 'The given data was invalid.', {
        form: ['Admins cannot be deleted from this screen.'],
      })
    }
    // users uses SoftDeletes in Laravel.
    existing.deleted_at = new Date().toISOString()
    const index = mockAdminUsers.indexOf(existing)
    if (index >= 0) mockAdminUsers.splice(index, 1)
  },
}
