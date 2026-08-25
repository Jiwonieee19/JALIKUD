export interface User {
  id: number
  name: string
  email: string
  role: 'user' | 'admin'
}

export interface AdminUser {
  id: number
  name: string
  email: string
  role: 'user' | 'admin'
  created_at: string | null
}

export interface AuthResponse {
  message: string
  user: User
  token?: string
}
