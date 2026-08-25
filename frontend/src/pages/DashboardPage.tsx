import { useAuth } from '../context/AuthContext'

const placeholders = ['Analytics', 'Reports', 'Automation']

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        Welcome back, {user?.name} 👋
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Here's an overview of your workspace.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {placeholders.map((label) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/50"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-10 w-10 text-slate-300 dark:text-slate-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 13.5 10.5 19.5l9.75-15M3.75 13.5 12 12m-8.25 1.5L9 21m9-16.5L9 21"
              />
            </svg>
            <h2 className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              {label}
            </h2>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Coming soon</p>
          </div>
        ))}
      </div>
    </div>
  )
}
