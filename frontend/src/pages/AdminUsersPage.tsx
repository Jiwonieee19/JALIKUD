import { useCallback, useEffect, useState, type FormEvent } from 'react'
import api from '../services/api'
import type { AdminUser } from '../types'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'

interface ListResponse {
  data: AdminUser[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}

interface FormState {
  name: string
  email: string
  password: string
  role: 'user' | 'admin'
}

const emptyForm: FormState = { name: '', email: '', password: '', role: 'user' }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [meta, setMeta] = useState<ListResponse['meta'] | null>(null)
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
      const response = await api.get<ListResponse>('/admin/users', {
        params: { search: search || undefined, page },
      })
      setUsers(response.data.data)
      setMeta(response.data.meta)
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
    setForm({ name: user.name, email: user.email, password: '', role: user.role })
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
    setSaving(true)
    setFormErrors({})
    try {
      if (editing) {
        await api.put(`/admin/users/${editing.id}`, {
          name: form.name,
          email: form.email,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        })
      } else {
        await api.post('/admin/users', form)
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
      await api.delete(`/admin/users/${user.id}`)
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
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400'
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
                />
                {formErrors.password && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {formErrors.password}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="au-role" className="mb-1.5">
                  Role
                </Label>
                <select
                  id="au-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as FormState['role'] })}
                  className="block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
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
