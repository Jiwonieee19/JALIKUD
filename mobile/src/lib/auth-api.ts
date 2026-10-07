import { apiRequest } from '@/lib/api';
import type {
  AuthResponse,
  LoginInput,
  MessageResponse,
  RegisterInput,
  User,
  UserResponse,
} from '@/lib/types';

export async function login(input: LoginInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/login', {
    method: 'POST',
    body: { email: input.email.trim().toLowerCase(), password: input.password },
  });
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/register', {
    method: 'POST',
    body: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: input.password,
      password_confirmation: input.password_confirmation,
      ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    },
  });
}

export async function getCurrentUser(token: string): Promise<User> {
  const response = await apiRequest<UserResponse>('/user', { token });
  return response.user;
}

export async function logout(token: string): Promise<void> {
  await apiRequest<MessageResponse>('/logout', { method: 'POST', token });
}

// Descriptive aliases retained for callers that prefer resource-oriented names.
export const loginUser = login;
export const registerUser = register;
export const fetchCurrentUser = getCurrentUser;
export const logoutUser = logout;

export type {
  AuthResponse,
  LaravelErrorResponse,
  LaravelValidationErrors,
  LoginInput,
  RegisterInput,
  User,
  UserRole,
} from '@/lib/types';