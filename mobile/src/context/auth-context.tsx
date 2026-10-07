import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '@/lib/auth-api';
import { clearToken, getToken, setToken } from '@/lib/token-storage';
import type { LoginInput, RegisterInput, User } from '@/lib/types';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateUser: (user: User) => void;

  /** Compatibility names for the previous mobile context. */
  current: User | null;
  signIn: (email: string, password: string) => Promise<User>;
  registerAccount: (input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    passwordConfirmation?: string;
  }) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Upper bound for startup session restore (SecureStore read + GET /user).
// Exceeding it signs out locally instead of hanging the launch flow.
const AUTH_RESTORE_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timed out.')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        // Never let startup hang here: a dead tunnel or a wedged SecureStore
        // must fall through to the signed-out login screen, not trap routing.
        const storedToken = await withTimeout(getToken(), AUTH_RESTORE_TIMEOUT_MS);
        if (!storedToken) return;

        const restoredUser = await withTimeout(getCurrentUser(storedToken), AUTH_RESTORE_TIMEOUT_MS);
        if (active) {
          setSessionToken(storedToken);
          setUser(restoredUser);
        }
      } catch {
        // A stored bearer token is only a claim. Remove it if verification fails.
        try {
          await clearToken();
        } catch {
          // Storage may itself be unavailable; the in-memory session stays signed out.
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const establishSession = useCallback(async (nextToken: string, nextUser: User) => {
    try {
      await setToken(nextToken);
    } catch (error) {
      // Do not leave a newly issued server token live when it cannot be secured.
      try {
        await logoutRequest(nextToken);
      } catch {
        // Preserve the secure-storage error, which is actionable for the user.
      }
      throw error;
    }
    setSessionToken(nextToken);
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await loginRequest(input);
      return establishSession(response.token, response.user);
    },
    [establishSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await registerRequest(input);
      return establishSession(response.token, response.user);
    },
    [establishSession],
  );

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    const refreshed = await getCurrentUser(token);
    setUser(refreshed);
    return refreshed;
  }, [token]);

  const logout = useCallback(async () => {
    const activeToken = token;
    setSessionToken(null);
    setUser(null);

    try {
      if (activeToken) await logoutRequest(activeToken);
    } catch {
      // Revocation is best effort; signing out locally must always succeed.
    }
    try {
      await clearToken();
    } catch {
      // The in-memory credential is already gone if secure storage is unavailable.
    }
  }, [token]);

  const signIn = useCallback(
    (email: string, password: string) => login({ email, password }),
    [login],
  );

  const registerAccount = useCallback(
    (input: {
      name: string;
      email: string;
      phone?: string;
      password: string;
      passwordConfirmation?: string;
    }) =>
      register({
        name: input.name,
        email: input.email,
        phone: input.phone,
        password: input.password,
        password_confirmation: input.passwordConfirmation ?? input.password,
      }),
    [register],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      refreshUser,
      updateUser: setUser,
      current: user,
      signIn,
      registerAccount,
      signOut: logout,
    }),
    [loading, login, logout, refreshUser, register, registerAccount, signIn, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function routeForRole(role: User['role']): '/(tabs)/menu' | '/staff/orders' | '/rider/deliveries' {
  if (role === 'rider') return '/rider/deliveries';
  if (role === 'staff' || role === 'admin') return '/staff/orders';
  return '/(tabs)/menu';
}

// Compatibility exports: existing screens can migrate independently.
export const AuthDemoProvider = AuthProvider;
export const useAuthDemo = useAuth;
export type DemoAccount = User;
export type DemoRole = User['role'];