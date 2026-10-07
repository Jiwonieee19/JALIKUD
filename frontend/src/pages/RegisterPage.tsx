import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fieldError } from '../services/api'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'
import Logo from '../components/ui/Logo'

interface ValidationErrors {
  name?: string[]
  email?: string[]
  phone?: string[]
  password?: string[]
  password_confirmation?: string[]
}

/**
 * Client-side mirror of the backend's App\Rules\StrongPassword, which requires
 * 8+ characters with at least one lowercase, one uppercase and one digit.
 *
 * Every composition failure reports ONE message. The API still names each
 * missing class individually ("must contain at least one number"), but this
 * guard runs first so a weak password never reaches it — and naming the class
 * that is missing hands anyone probing this form a running tally of what is
 * still missing. Length stays a separate message because it is already in the
 * field's own hint text.
 */
function passwordProblem(password: string): string | null {
  if (password.length === 0) return null
  if (password.length < 8) return 'Must be at least 8 characters.'
  const strong = /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password)
  if (!strong) return 'Must contain uppercase, lowercase and a number.'
  return null
}

/**
 * A PH mobile is fixed at +63 9 XXXXXXXX — the country code and the leading 9
 * are both part of the format, so both are static on the field and only the
 * trailing 9 digits are typed. Stored locally that is 09XXXXXXXXX.
 */
const PH_MOBILE_TAIL = 9

/** Keeps only digits and caps the length — used while typing. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, PH_MOBILE_TAIL)
}

/** What the field holds -> the local form the API and database store. */
function toStoredPhone(value: string): string | null {
  return value === '' ? null : `09${value}`
}

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Confirmation before strength: a mismatch is a typo the user just made and
    // is more useful to report than anything about the password itself.
    if (password !== passwordConfirmation) {
      setErrors({ password_confirmation: ['Password confirmation does not match.'] })
      setGeneralError('')
      return
    }

    // Same rules the API enforces, checked before the request. Register is
    // throttled to 5/min per IP, so a weak password should never spend a slot.
    // The message is the same one the backend returns and never names which
    // character class is missing.
    const weak = passwordProblem(password)
    if (weak) {
      setErrors({ password: [weak] })
      setGeneralError('')
      return
    }

    setErrors({})
    setGeneralError('')
    setSubmitting(true)

    try {
      await register(name, email, password, passwordConfirmation, toStoredPhone(phone) ?? undefined)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      // Laravel's 422 carries one message per field; anything else (403, 429,
      // network) collapses into `form`.
      const mapped = fieldError(err)
      setErrors(
        Object.fromEntries(
          Object.entries(mapped).map(([field, message]) => [field, [message]]),
        ),
      )
      if (mapped.form) setGeneralError(mapped.form)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo heightClass="h-16" />
            <h1 className="sr-only">JALIKUD</h1>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Create a new account to get started
            </p>
          </div>

          {generalError && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {generalError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name" className="mb-1.5">
                Full name
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Your name"
              />
              {errors.name && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.name[0]}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email" className="mb-1.5">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.email[0]}</p>
              )}
                        </div>

            <div>
              <Label htmlFor="phone" className="mb-1.5">
                Phone <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-slate-500 dark:text-slate-400">
                  +63 9
                </span>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={PH_MOBILE_TAIL}
                  value={phone}
                  onChange={(e) => setPhone(digitsOnly(e.target.value))}
                  placeholder="123456789"
                  aria-invalid={Boolean(errors.phone)}
                  // Both branches are complete literals so Tailwind's scanner
                  // finds pl-12; interpolated prefixes are never generated.
                  className={errors.phone ? 'pl-12 border-red-500 dark:border-red-500' : 'pl-12'}
                />
              </div>
              {errors.phone && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.phone[0]}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password" className="mb-1.5">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                aria-invalid={Boolean(errors.password)}
                className={errors.password ? 'border-red-500 dark:border-red-500' : ''}
              />
              <p
                className={`mt-1.5 text-xs ${
                  errors.password
                    ? 'font-semibold text-red-600 dark:text-red-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {errors.password?.[0] ??
                  'At least 8 characters, with an uppercase letter, a lowercase letter and a number.'}
              </p>
            </div>

            <div>
              <Label htmlFor="password-confirmation" className="mb-1.5">
                Confirm password
              </Label>
              <Input
                id="password-confirmation"
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                aria-invalid={Boolean(errors.password_confirmation)}
                className={
                  errors.password_confirmation ? 'border-red-500 dark:border-red-500' : ''
                }
              />
              {errors.password_confirmation && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                  {errors.password_confirmation[0]}
                </p>
              )}
            </div>

            <Button type="submit" disabled={submitting} className="w-full py-2.5">
              {submitting ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-bold text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
