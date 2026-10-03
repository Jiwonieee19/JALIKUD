import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { clearToken, getToken, setToken } from '../services/api'
import { mockCurrentUser } from '../mock/users'
import type { AuthResponse, User } from '../types'

/**
 * MOCK AUTH — the frontend is being built design-first, so this provider does
 * NOT talk to the backend. Any password of 8+ characters containing an
 * uppercase letter and a digit is accepted, and the session user is always
 * `mockCurrentUser` (an admin).
 *
 * TODO(next-dev): restore the real implementation. It is preserved below and
 * only needs the `api` import restored plus the bodies of login/register/
 * logout uncommented. See docs/API_WIRING.md → "Auth".
 *
 *   import api from '../services/api'
 *   const response = await api.post<AuthResponse>('/login', { email, password })
 *   setToken(response.data.token!)
 *   setUser(response.data.user)
 *
 * The token bootstrap (GET /api/user on mount) should come back too.
 *
 * The real backend seeds NO users — the first admin must be promoted manually.
 */

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string,
    phone?: string,
  ) => Promise<void>
  updateUser: (user: User) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/** Mirrors App\Rules\StrongPassword on the backend. */
const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore the mock session on mount if a token exists.
    const bootstrap = () => {
      if (!getToken()) {
        setLoading(false)
        return
      }
      setUser(mockCurrentUser)
      setLoading(false)
    }
    bootstrap()
  }, [])

  const login = async (_email: string, password: string) => {
    if (!STRONG.test(password)) {
      throw {
        response: {
          status: 422,
          data: {
            message: 'The given data was invalid.',
            errors: { password: ['Password must be at least 8 characters and include an uppercase letter and a digit.'] },
          },
        },
      }
    }
    const response: AuthResponse = {
      message: 'Login successful.',
      user: mockCurrentUser,
      token: 'mock-token-not-real',
    }
    setToken(response.token!)
    setUser(response.user)
  }

  const register = async (name: string, email: string, _password: string, _passwordConfirmation: string, phone?: string) => {
    const response: AuthResponse = {
      message: 'Registration successful.',
      user: { ...mockCurrentUser, id: 99, name, email, phone: phone ?? null, role: 'customer' },
      token: 'mock-token-not-real',
    }
    setToken(response.token!)
    setUser(response.user)
  }

  const updateUser = (updated: User) => {
    setUser(updated)
  }

  const logout = async () => {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
