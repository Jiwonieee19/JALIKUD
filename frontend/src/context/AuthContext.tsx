import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import api, { clearToken, getToken, setToken } from '../services/api'
import type { AuthResponse, User } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, passwordConfirmation: string) => Promise<void>
  updateUser: (user: User) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session on mount if a token exists
    const bootstrap = async () => {
      if (!getToken()) {
        setLoading(false)
        return
      }
      try {
        const response = await api.get<{ user: User }>('/user')
        setUser(response.data.user)
      } catch {
        clearToken()
      } finally {
        setLoading(false)
      }
    }
    void bootstrap()
  }, [])

  const login = async (email: string, password: string) => {
    const response = await api.post<AuthResponse>('/login', { email, password })
    setToken(response.data.token!)
    setUser(response.data.user)
  }

  const register = async (name: string, email: string, password: string, passwordConfirmation: string) => {
    const response = await api.post<AuthResponse>('/register', {
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
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
    } finally {
      clearToken()
      setUser(null)
    }
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
