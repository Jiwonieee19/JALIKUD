import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// Temporary in-memory accounts for the prototype. Nothing here is persisted —
// restarting the app resets every account back to the seeded demo users.
export type DemoRole = 'customer' | 'staff' | 'rider';

export type DemoAccount = {
  id: string;
  role: DemoRole;
  name: string;
  email: string;
  phone: string;
  password: string;
};

const DEMO_PASSWORD = 'demo1234';

const INITIAL_ACCOUNTS: DemoAccount[] = [
  {
    id: 'demo-customer',
    role: 'customer',
    name: 'Maria Santos',
    email: 'customer@demo.ph',
    phone: '09171234567',
    password: DEMO_PASSWORD,
  },
  {
    id: 'demo-staff',
    role: 'staff',
    name: 'Alex Rivera',
    email: 'staff@demo.ph',
    phone: '09181234567',
    password: DEMO_PASSWORD,
  },
  {
    id: 'demo-rider',
    role: 'rider',
    name: 'Jomar Cruz',
    email: 'rider@demo.ph',
    phone: '09191234567',
    password: DEMO_PASSWORD,
  },
];

export const DEMO_CREDENTIALS = {
  password: DEMO_PASSWORD,
  customerEmail: INITIAL_ACCOUNTS[0].email,
  staffEmail: INITIAL_ACCOUNTS[1].email,
  riderEmail: INITIAL_ACCOUNTS[2].email,
};

type SignInResult = { ok: true } | { ok: false; error: string };

type AuthDemoContextValue = {
  accounts: DemoAccount[];
  current: DemoAccount | null;
  signIn: (email: string, password: string) => SignInResult;
  signOut: () => void;
  registerAccount: (input: { name: string; email: string; phone: string; password: string }) => SignInResult;
};

const AuthDemoContext = createContext<AuthDemoContextValue | undefined>(undefined);

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function AuthDemoProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState(INITIAL_ACCOUNTS);
  const [current, setCurrent] = useState<DemoAccount | null>(null);

  const value = useMemo<AuthDemoContextValue>(() => {
    const signIn = (email: string, password: string): SignInResult => {
      const candidate = accounts.find((account) => account.email === normalizeEmail(email));
      if (!candidate || candidate.password !== password) {
        return { ok: false, error: 'Incorrect email or password. Try a demo account below.' };
      }
      setCurrent(candidate);
      return { ok: true };
    };

    const signOut = () => {
      setCurrent(null);
    };

    const registerAccount = (input: {
      name: string;
      email: string;
      phone: string;
      password: string;
    }): SignInResult => {
      const email = normalizeEmail(input.email);
      if (accounts.some((account) => account.email === email)) {
        return { ok: false, error: 'That email is already registered. Try signing in instead.' };
      }
      const account: DemoAccount = {
        id: `${Date.now()}-${Math.random()}`,
        role: 'customer',
        name: input.name.trim(),
        email,
        phone: input.phone.trim(),
        password: input.password,
      };
      setAccounts((existing) => [...existing, account]);
      setCurrent(account);
      return { ok: true };
    };

    return { accounts, current, signIn, signOut, registerAccount };
  }, [accounts, current]);

  return <AuthDemoContext.Provider value={value}>{children}</AuthDemoContext.Provider>;
}

export function useAuthDemo(): AuthDemoContextValue {
  const context = useContext(AuthDemoContext);
  if (!context) throw new Error('useAuthDemo must be used inside AuthDemoProvider');
  return context;
}