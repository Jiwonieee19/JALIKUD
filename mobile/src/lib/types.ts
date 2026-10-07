export type UserRole = 'customer' | 'staff' | 'admin' | 'rider';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface UserResponse {
  user: User;
}

export interface MessageResponse {
  message: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirmation: string;
}

export type LaravelValidationErrors = Record<string, string[]>;

export interface LaravelErrorResponse {
  message?: string;
  errors?: LaravelValidationErrors;
}