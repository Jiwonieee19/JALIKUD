import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { mockAdminUsersApi } from '../mock/adminUsersApi'
import type { AdminUser } from '../types'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Label from '../components/ui/Label'

/**
 * Data now comes from src/mock/adminUsersApi.ts so this page renders with no
 * backend. To go live, delete that import and restore `import api from
 * '../services/api'` — the four call sites below are already written against
 * the real endpoint contracts. See docs/API_WIRING.md.
 *
 * `meta` is kept typed against Laravel's paginator envelope
 * ({ current_page, last_page, per_page, total }) so the swap is mechanical.
 */

interface PaginatorMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

interface FormState {
  name: string
  email: string
  phone: string
  password: string
  password_confirmation: string
  role: 'customer' | 'staff' | 'admin' | 'rider'
}

const emptyForm: FormState = {
  name: '',
  email: '',
  phone: '',
  password: '',
  password_confirmation: '',
  role: 'customer',
}

/**
 * Client-side mirror of the backend's App\Rules\StrongPassword, which requires
 * 8+ characters with at least one lowercase, one uppercase and one digit
 * ($requireSpecial defaults to false, so no symbol is needed).
 *
 * Without this the form only enforced length, so a weak password passed the
 * client and came back as a 422 round-trip. Kept in sync with
 * backend/app/Rules/StrongPassword.php.
 *
 * Returns null for an empty string so the same helper serves both the create
 * form (where blank is an error) and the edit form (where blank means "keep the
 * current password").
 */
function passwordProblem(password: string): string | null {
  if (password.length === 0) return null
  if (password.length < 8) return 'Must be at least 8 characters.'
  if (!/[a-z]/.test(password)) return 'Must contain at least one lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Must contain at least one uppercase letter.'
  if (!/[0-9]/.test(password)) return 'Must contain at least one number.'
  return null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [meta, setMeta] = useState<PaginatorMeta | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await mockAdminUsersApi.list({
        search: search || undefined,
        page,
      })
      setUsers(response.data)
      setMeta(response.meta)
      setError('')
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  const openCreate = () => {
    setForm(emptyForm)
    setFormErrors({})
    setEditing(null)
    setCreating(true)
  }

  const openEdit = (user: AdminUser) => {
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      password: '',
      password_confirmation: '',
      role: user.role,
    })
    setFormErrors({})
    setCreating(false)
    setEditing(user)
  }

  const closeModal = () => {
    setCreating(false)
    setEditing(null)
    setFormErrors({})
  }

  const extractFieldError = (err: unknown): Record<string, string> => {
    type AxiosLikeError = {
      response?: {
        status?: number
        data?: { message?: string; errors?: Record<string, string[]> }
      }
    }
    const axiosError = err as AxiosLikeError
    if (axiosError?.response?.status === 422 && axiosError.response.data?.errors) {
      return Object.fromEntries(
        Object.entries(axiosError.response.data.errors).map(([k, v]) => [k, v[0]]),
      )
    }
    return { form: axiosError?.response?.data?.message ?? 'Request failed.' }
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Password rules are enforced here as well as on the inputs, because the
    // complexity and confirmation rules have no native HTML equivalent. Without
    // this the request would go out and come back as a 422.
    const localErrors: Record<string, string> = {}
    const weak = passwordProblem(form.password)

    if (!editing && form.password.length === 0) {
      localErrors.password = 'A password is required.'
    } else if (weak) {
      localErrors.password = weak
    }

    if (form.password.length > 0 && form.password_confirmation !== form.password) {
      localErrors.password_confirmation = 'Passwords do not match.'
    }

    if (Object.keys(localErrors).length > 0) {
      setFormErrors(localErrors)
      return
    }

    setSaving(true)
    setFormErrors({})
    try {
      if (editing) {
        await mockAdminUsersApi.update(editing.id, {
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          role: form.role,
          // Omitted entirely when blank so the API leaves the stored hash alone
          // ('password' is 'sometimes' on UpdateUserRequest).
          ...(form.password ? { password: form.password } : {}),
        })
      } else {
        await mockAdminUsersApi.store({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        })
      }
      closeModal()
      await fetchUsers()
    } catch (err) {
      setFormErrors(extractFieldError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user: AdminUser) => {
    if (!window.confirm(`Delete ${user.email}? This cannot be undone.`)) return
    setDeletingId(user.id)
    try {
      await mockAdminUsersApi.destroy(user.id)
      await fetchUsers()
    } catch (err) {
      alert(extractFieldError(err).form)
    } finally {
      setDeletingId(null)
    }
  }

  const showForm = creating || editing !== null

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
          {meta && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {meta.total} registered account{meta.total === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <Button onClick={openCreate}>+ Add User</Button>
      </div>

      <div className="mt-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="max-w-xs"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Registered</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                      No users found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  users.map((u) => (
                    <tr key={u.id} className="text-slate-700 dark:text-slate-300">
                      <td className="px-3 py-2.5 font-medium">{u.name}</td>
                      <td className="px-3 py-2.5">{u.email}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.role === 'admin'
                              ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => openEdit(u)}>
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            disabled={deletingId === u.id}
                            onClick={() => void handleDelete(u)}
                          >
                            {deletingId === u.id ? '…' : 'Delete'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between pt-4 text-sm text-slate-500 dark:text-slate-400">
              <span>
                Page {meta.current_page} of {meta.last_page}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={meta.current_page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={meta.current_page >= meta.last_page}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              {editing ? `Edit ${editing.name}` : 'Add User'}
            </h2>

            {formErrors.form && (
              <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                {formErrors.form}
              </p>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <Label htmlFor="au-name" className="mb-1.5">
                  Name
                </Label>
                <Input
                  id="au-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="au-email" className="mb-1.5">
                  Email
                </Label>
                <Input
                  id="au-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
                {formErrors.email && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.email}</p>
                )}
              </div>
              <div>
                <Label htmlFor="au-phone" className="mb-1.5">
                  Phone
                </Label>
                <Input
                  id="au-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +63 912 345 6789"
                />
                {formErrors.phone && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.phone}</p>
                )}
              </div>
              <div>
                <Label htmlFor="au-password" className="mb-1.5">
                  Password{' '}
                  {editing && (
                    <span className="font-normal text-slate-400">(leave blank to keep)</span>
                  )}
                </Label>
                <Input
                  id="au-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editing}
                  minLength={editing ? undefined : 8}
                  autoComplete="new-password"
                  aria-invalid={Boolean(formErrors.password)}
                  className={formErrors.password ? 'border-red-500 dark:border-red-500' : ''}
                />
                <p
                  className={`mt-1 text-xs ${
                    formErrors.password
                      ? 'font-semibold text-red-600 dark:text-red-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {formErrors.password ?? 'At least 8 characters, with an uppercase letter, a lowercase letter and a number.'}
                </p>
              </div>

              <div>
                <Label htmlFor="au-password-confirm" className="mb-1.5">
                  Confirm password
                </Label>
                <Input
                  id="au-password-confirm"
                  type="password"
                  value={form.password_confirmation}
                  onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })}
                  // Only mandatory once a password has actually been typed, so
                  // the edit form stays usable when leaving the password alone.
                  required={form.password.length > 0}
                  autoComplete="new-password"
                  aria-invalid={Boolean(formErrors.password_confirmation)}
                  className={
                    formErrors.password_confirmation ? 'border-red-500 dark:border-red-500' : ''
                  }
                />
                <p
                  className={`mt-1 text-xs ${
                    formErrors.password_confirmation
                      ? 'font-semibold text-red-600 dark:text-red-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {formErrors.password_confirmation ??
                    (form.password.length > 0
                      ? 'Re-enter the password exactly as typed above.'
                      : 'Only needed if you are setting a new password.')}
                </p>
              </div>
<div>
                  <Label htmlFor="au-role" className="mb-1.5">
                    Role
                  </Label>
                  <Select
                    id="au-role"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as FormState['role'] })}
                  >
                    <option value="customer">customer</option>
                    <option value="staff">staff</option>
                    <option value="admin">admin</option>
                    <option value="rider">rider</option>
                  </Select>
                  {formErrors.role && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.role}</p>
                  )}
                </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
