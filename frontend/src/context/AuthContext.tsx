import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import api, { clearToken, getToken, setToken } from '../services/api'
import type { AuthResponse, User } from '../types'

/**
 * Real authentication against the Laravel API.
 *
 *   POST /api/register  -> 201 { message, user, token }   (role forced to customer)
 *   POST /api/login     -> 200 { message, user, token }
 *   GET  /api/user      -> 200 { user }                   (auth:sanctum)
 *   POST /api/logout    -> 200 { message }                (revokes the token)
 *
 * Errors are thrown as real axios errors so callers can use `fieldError(err)`
 * from services/api to map Laravel's 422 `errors` bag onto form fields.
 *
 * RegisterRequest requires `password_confirmation` (Laravel's `confirmed` rule),
 * so it must be sent. LoginRequest only wants email + password; bad credentials
 * come back as a 422 keyed on `email`, never a 401.
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore the session on mount: a token in localStorage is only a claim, so
    // it has to be verified against GET /api/user before we trust it.
    let cancelled = false

    const bootstrap = async () => {
      if (!getToken()) {
        setLoading(false)
        return
      }

      try {
        const response = await api.get<{ user: User }>('/user')
        if (!cancelled) setUser(response.data.user)
      } catch {
        // Expired or revoked — drop it so the app shows the login screen.
        clearToken()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  const login = async (email: string, password: string) => {
    const response = await api.post<AuthResponse>('/login', {
      email: email.trim(),
      password,
    })

    setToken(response.data.token!)
    setUser(response.data.user)
  }

  const register = async (
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string,
    phone?: string,
  ) => {
    const response = await api.post<AuthResponse>('/register', {
      name: name.trim(),
      email: email.trim(),
      password,
      password_confirmation: passwordConfirmation,
      ...(phone?.trim() ? { phone: phone.trim() } : {}),
    })

    setToken(response.data.token!)
    setUser(response.data.user)
  }

  const updateUser = (updated: User) => {
    setUser(updated)
  }

  const logout = async () => {
    try {
      await api.post('/logout')
    } catch {
      // Revoking server-side is best effort; the local token must still go.
    }
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
