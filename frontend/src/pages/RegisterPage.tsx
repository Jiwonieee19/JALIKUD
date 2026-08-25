import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Label from '../components/ui/Label'

interface ValidationErrors {
  name?: string[]
  email?: string[]
  password?: string[]
}

export default function RegisterPage() {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password !== passwordConfirmation) {
      setErrors({ password: ['Password confirmation does not match.'] })
      return
    }
    setErrors({})
    setGeneralError('')
    setSubmitting(true)

    try {
      await register(name, email, password, passwordConfirmation)
    } catch (err: unknown) {
      type AxiosLikeError = {
        response?: { status?: number; data?: { message?: string; errors?: ValidationErrors } }
      }
      const axiosError = err as AxiosLikeError
      if (axiosError?.response?.status === 422) {
        setErrors(axiosError.response.data?.errors ?? {})
      } else {
        setGeneralError(
          axiosError?.response?.data?.message ??
            'Unable to connect to the server. Please try again.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:p-10">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-widest text-indigo-600 dark:text-indigo-400">
              JALIKUD
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
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
              />
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                  {errors.password[0]}
                </p>
              )}
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
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full py-2.5">
              {submitting ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
