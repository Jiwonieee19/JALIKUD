import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

interface ValidationErrors {
  email?: string[]
  password?: string[]
}

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrors({})
    setGeneralError('')
    setSubmitting(true)

    try {
      await login(email, password)
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
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>JALIKUD</h1>
        <p style={styles.subtitle}>Sign in to your account</p>

        {generalError && <p style={styles.error}>{generalError}</p>}

        <label style={styles.label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={styles.input}
          placeholder="you@example.com"
        />
        {errors.email && <p style={styles.error}>{errors.email[0]}</p>}

        <label style={styles.label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={styles.input}
          placeholder="••••••••"
        />
        {errors.password && <p style={styles.error}>{errors.password[0]}</p>}

        <button type="submit" disabled={submitting} style={styles.button}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f3f4f6',
    padding: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  title: {
    margin: 0,
    textAlign: 'center' as const,
    fontSize: '1.75rem',
    letterSpacing: '0.05em',
  },
  subtitle: {
    margin: '0 0 1rem',
    textAlign: 'center' as const,
    color: '#6b7280',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    padding: '0.6rem 0.75rem',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: '1rem',
    outline: 'none',
  },
  button: {
    marginTop: '1rem',
    padding: '0.7rem',
    borderRadius: 8,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: '#dc2626',
    fontSize: '0.85rem',
    margin: '0.25rem 0 0',
  },
}
