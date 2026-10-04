import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminMenuPage from './pages/AdminMenuPage'
import AdminOrdersPage from './pages/AdminOrdersPage'
import AdminCouponsPage from './pages/AdminCouponsPage'
import AdminRewardsPage from './pages/AdminRewardsPage'
import AdminSettingsPage from './pages/AdminSettingsPage'
import type { ReactNode } from 'react'

function Loading() {
  return (
    <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
      Loading…
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  return user.role === 'admin' ? (
    <>{children}</>
  ) : (
    <Navigate to="/dashboard" replace />
  )
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    )
  }
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <LoginPage />
                </PublicOnly>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnly>
                  <RegisterPage />
                </PublicOnly>
              }
            />
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="/admin/orders"
                element={
                  <RequireAdmin>
                    <AdminOrdersPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/menu"
                element={
                  <RequireAdmin>
                    <AdminMenuPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/coupons"
                element={
                  <RequireAdmin>
                    <AdminCouponsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/rewards"
                element={
                  <RequireAdmin>
                    <AdminRewardsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/store-settings"
                element={
                  <RequireAdmin>
                    <AdminSettingsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RequireAdmin>
                    <AdminUsersPage />
                  </RequireAdmin>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
