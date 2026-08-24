export interface User {
  id: number
  name: string
  email: string
}

export interface AuthResponse {
  message: string
  user: User
  token?: string
}
