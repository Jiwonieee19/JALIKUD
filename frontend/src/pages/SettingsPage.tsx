import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import type { User } from '../types'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import ThemeToggle from '../components/ui/ThemeToggle'

interface ValidationErrors {
  name?: string[]
  email?: string[]
  current_password?: string[]
  password?: string[]
}

type Feedback = { type: 'success' | 'error'; message: string } | null

function extractErrors(err: unknown): [ValidationErrors, string] {
  type AxiosLikeError = {
    response?: { status?: number; data?: { message?: string; errors?: ValidationErrors } }
  }
  const axiosError = err as AxiosLikeError
  if (axiosError?.response?.status === 422) {
    return [axiosError.response.data?.errors ?? {}, '']
  }
  return [{}, axiosError?.response?.data?.message ?? 'Something went wrong. Please try again.']
}

const feedbackClass = (type: 'success' | 'error') =>
  type === 'success'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
    : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [profileErrors, setProfileErrors] = useState<ValidationErrors>({})
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<ValidationErrors>({})
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileErrors({})
    setProfileFeedback(null)
    setSavingProfile(true)
    try {
      const response = await api.put<{ user: User }>('/profile', { name, email })
      updateUser(response.data.user)
      setProfileFeedback({ type: 'success', message: 'Profile updated successfully.' })
    } catch (err) {
      const [errors, general] = extractErrors(err)
      setProfileErrors(errors)
      if (general) setProfileFeedback({ type: 'error', message: general })
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (newPassword !== newPasswordConfirmation) {
      setPasswordErrors({ password: ['Password confirmation does not match.'] })
      return
    }
    setPasswordErrors({})
    setPasswordFeedback(null)
    setSavingPassword(true)
    try {
      await api.put('/password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: newPasswordConfirmation,
      })
      setPasswordFeedback({ type: 'success', message: 'Password changed successfully.' })
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirmation('')
    } catch (err) {
      const [errors, general] = extractErrors(err)
      setPasswordErrors(errors)
      if (general) setPasswordFeedback({ type: 'error', message: general })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Manage your account settings and preferences.
      </p>

      <div className="mt-8 space-y-6">
        <Card title="Profile" description="Update your account's name and email address.">
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {profileFeedback && (
              <div className={`rounded-lg px-4 py-3 text-sm ${feedbackClass(profileFeedback.type)}`}>
                {profileFeedback.message}
              </div>
            )}
            <div>
              <Label htmlFor="settings-name" className="mb-1.5">Full name</Label>
              <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} required />
              {profileErrors.name && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{profileErrors.name[0]}</p>
              )}
            </div>
            <div>
              <Label htmlFor="settings-email" className="mb-1.5">Email address</Label>
              <Input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {profileErrors.email && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{profileErrors.email[0]}</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Change Password" description="Choose a strong password of at least 8 characters.">
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {passwordFeedback && (
              <div className={`rounded-lg px-4 py-3 text-sm ${feedbackClass(passwordFeedback.type)}`}>
                {passwordFeedback.message}
              </div>
            )}
            <div>
              <Label htmlFor="current-password" className="mb-1.5">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              {passwordErrors.current_password && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                  {passwordErrors.current_password[0]}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="new-password" className="mb-1.5">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              {passwordErrors.password && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                  {passwordErrors.password[0]}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="confirm-password" className="mb-1.5">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={newPasswordConfirmation}
                onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? 'Updating…' : 'Update Password'}
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Appearance" description="Choose how JALIKUD looks on this device.">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700 dark:text-slate-300">Color theme</span>
            <ThemeToggle />
          </div>
        </Card>

        <Card title="Session" description="Log out of your account on this device.">
          <div className="flex items-center justify-between gap-4">
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
            <Button variant="danger" onClick={() => void logout()}>
              Log Out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
