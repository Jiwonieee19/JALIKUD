import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../ui/ThemeToggle'
import Button from '../ui/Button'

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path
          fillRule="evenodd"
          d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path
          fillRule="evenodd"
          d="M8.34 1.66a1.5 1.5 0 0 1 3.32 0c.16.72.97 1.08 1.63.74a1.5 1.5 0 0 1 2.35 2.35c-.34.66.02 1.47.74 1.63a1.5 1.5 0 0 1 0 3.32c-.72.16-1.08.97-.74 1.63a1.5 1.5 0 0 1-2.35 2.35c-.66-.34-1.47.02-1.63.74a1.5 1.5 0 0 1-3.32 0c-.16-.72-.97-1.08-1.63-.74a1.5 1.5 0 0 1-2.35-2.35c.34-.66-.02-1.47-.74-1.63a1.5 1.5 0 0 1 0-3.32c.72-.16 1.08-.97.74-1.63a1.5 1.5 0 0 1-2.35-2.35c.34-.66-.02-1.47-.74-1.63a1.5 1.5 0 0 1 0-3.32c.72-.16 1.08-.97.74-1.63a1.5 1.5 0 0 1 2.35-2.35c.66.34 1.47-.02 1.63-.74ZM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
]

const adminNavItems = [
  {
    to: '/admin/users',
    label: 'Users',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm-10.667 5.333A4.667 4.667 0 0 1 12 17.86v.14H2v-.14a4.667 4.667 0 0 1 5.333-4.527ZM14 13.5a3.5 3.5 0 0 1 3.5 3.5v1H14v-1c0-.864-.217-1.68-.602-2.394.194.058.396.094.602.094v-.2Z" />
      </svg>
    ),
  },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const allItems = user?.role === 'admin' ? [...navItems, ...adminNavItems] : navItems

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
    }`

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="mb-8 px-2 text-xl font-bold tracking-wide text-slate-900 dark:text-white">
          JALIKUD
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {allItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClasses}>
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="min-w-0">
            <ThemeToggle compact />
          </div>
          <div className="flex items-center justify-between px-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {user?.name}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
            <Button variant="ghost" onClick={() => void handleLogout()} title="Log out">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v5.5A2.25 2.25 0 0 1 10.75 12h-5.5A2.25 2.25 0 0 1 3 9.75v-5.5Zm7.78 4.97 3.75 3.75a.75.75 0 0 0 1.06 0l3.75-3.75a.75.75 0 0 0-1.06-1.06L15.75 10.5V4.25a.75.75 0 0 0-1.5 0v6.25L11.84 8.16a.75.75 0 0 0-1.06 1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:hidden">
          <span className="text-lg font-bold tracking-wide text-slate-900 dark:text-white">
            JALIKUD
          </span>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:hidden">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClasses}>
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex flex-1 items-center justify-center gap-3 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path
              fillRule="evenodd"
              d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v5.5A2.25 2.25 0 0 1 10.75 12h-5.5A2.25 2.25 0 0 1 3 9.75v-5.5Zm14 3.25a.75.75 0 0 1 .75.75v6a2.25 2.25 0 0 1-2.25 2.25h-10.5A2.25 2.25 0 0 1 2.75 14v-6a.75.75 0 0 1 1.5 0v6a.75.75 0 0 0 .75.75h10.5a.75.75 0 0 0 .75-.75v-6a.75.75 0 0 1 .75-.75Zm-8.72-2.03 2.25-2.25a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 1 1-1.06 1.06l-.97-.97v5.19a.75.75 0 0 1-1.5 0V3.31l-.97.97a.75.75 0 0 1-1.06-1.06Z"
              clipRule="evenodd"
            />
          </svg>
          <span>Log out</span>
        </button>
      </nav>
    </div>
  )
}
