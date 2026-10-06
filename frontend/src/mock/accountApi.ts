import { mockCurrentUser } from './users'
import type { User } from '../types'

/**
 * MOCK API — stands in for:
 *   PUT /api/profile   { name, email }                       -> { user }
 *   PUT /api/password  { current_password, password, password_confirmation }
 *
 * TODO(next-dev): delete this file and restore `import api from '../services/api'`
 * in src/pages/SettingsPage.tsx. The two call sites are already written against
 * the real endpoints, so the swap is mechanical:
 *
 *   const response = await api.put<{ user: User }>('/profile', { name, email })
 *   await api.put('/password', {
 *     current_password: currentPassword,
 *     password: newPassword,
 *     password_confirmation: newPasswordConfirmation,
 *   })
 *
 * Validation below mirrors the Laravel request classes exactly:
 *
 *   UpdateProfileRequest  (app/Http/Requests/Auth/UpdateProfileRequest.php)
 *     name  required, string, max:255, min:2
 *     email required, email, max:255, unique:users,email ignoring self
 *
 *   UpdatePasswordRequest (app/Http/Requests/Auth/UpdatePasswordRequest.php)
 *     current_password required, current_password:sanctum
 *     password           required, confirmed, App\Rules\StrongPassword
 *
 *   App\Rules\StrongPassword: min 8, one lowercase, one uppercase, one digit.
 *
 * Failures throw an AXIOS-SHAPED object ({ response: { status, data } }) so the
 * page's existing extractErrors() keeps working with no changes.
 *
 * Auth: both routes require a Sanctum token (auth:sanctum).
 */

type FieldErrors = Record<string, string[]>

function fail(status: number, message: string, errors?: FieldErrors): never {
  throw { response: { status, data: { message, ...(errors ? { errors } : {}) } } }
}

const LATENCY_MS = 200
const wait = (ms = LATENCY_MS) => new Promise((resolve) => setTimeout(resolve, ms))

/** Mirrors App\Rules\StrongPassword. */
const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

/**
 * The signed-in user's password in the mock session. `mockCurrentUser` carries no
 * password (deliberately — it's the response shape of GET /api/user), so the mock
 * auth layer keeps a stand-in here. The prototype's shared demo password was
 * `demo1234` on the mobile side.
 */
const MOCK_CURRENT_PASSWORD = 'Password123'

/**
 * PUT /api/profile
 * Mutates and returns the module-level mock user so the sidebar and settings
 * page stay in sync within a session.
 */
export async function updateProfile(payload: {
  name: string
  email: string
}): Promise<{ user: User }> {
  await wait()

  const errors: FieldErrors = {}
  const name = payload.name?.trim() ?? ''
  const email = payload.email?.trim() ?? ''

  if (!name) {
    errors.name = ['Please provide your full name.']
  } else if (name.length < 2) {
    errors.name = ['The name must be at least 2 characters.']
  } else if (name.length > 255) {
    errors.name = ['The name may not be greater than 255 characters.']
  }

  if (!email) {
    errors.email = ['Please provide an email address.']
  } else if (!/^\S+@\S+\.\S+$/.test(email)) {
    errors.email = ['Please provide a valid email address.']
  } else if (email.length > 255) {
    errors.email = ['The email may not be greater than 255 characters.']
  } else if (email.toLowerCase() !== mockCurrentUser.email.toLowerCase()) {
    // Stands in for unique:users,email — this mock has a single account.
    errors.email = ['Another account already uses this email.']
  }

  if (Object.keys(errors).length > 0) {
    fail(422, 'The given data was invalid.', errors)
  }

  mockCurrentUser.name = name
  mockCurrentUser.email = email
  return { user: { ...mockCurrentUser } }
}

/** PUT /api/password */
export async function updatePassword(payload: {
  current_password: string
  password: string
  password_confirmation: string
}): Promise<void> {
  await wait()

  const errors: FieldErrors = {}

  if (!payload.current_password) {
    errors.current_password = ['Please provide your current password.']
  } else if (payload.current_password !== MOCK_CURRENT_PASSWORD) {
    errors.current_password = ['The current password is incorrect.']
  }

  if (!payload.password) {
    errors.password = ['Please provide a password.']
  } else if (payload.password !== payload.password_confirmation) {
    // Laravel's `confirmed` rule. The page also checks this client-side, so this
    // is a backstop rather than the usual path.
    errors.password = ['The new password confirmation does not match.']
  } else if (!STRONG.test(payload.password)) {
    errors.password = [
      'The password must be at least 8 characters and include an uppercase letter and a digit.',
    ]
  }

  if (Object.keys(errors).length > 0) {
    fail(422, 'The given data was invalid.', errors)
  }
}