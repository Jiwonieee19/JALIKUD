import { useTheme, type Theme } from '../../context/ThemeContext'
import type { ReactNode } from 'react'

const options: { value: Theme; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M10 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm4.24 2.76a1 1 0 0 1 0 1.41l-.7.71a1 1 0 1 1-1.42-1.42l.71-.7a1 1 0 0 1 1.41 0ZM17 9a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2h1Zm-2.76 4.24a1 1 0 0 1 1.42 1.42l-.71.7a1 1 0 0 1-1.41-1.41l.7-.71ZM10 15a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm-4.24-1.76a1 1 0 0 1 1.41 1.41l-.7.71a1 1 0 1 1-1.42-1.42l.71-.7ZM3 9a1 1 0 0 1 0 2H2a1 1 0 1 1 0-2h1Zm1.47-4.24a1 1 0 0 1 1.41 0l.71.7A1 1 0 0 1 5.17 6.88l-.7-.71a1 1 0 0 1 0-1.41ZM10 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'System',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path
          fillRule="evenodd"
          d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5Zm3.5 11a.75.75 0 0 0 0 1.5h9a.75.75 0 0 0 0-1.5h-9Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
        <path d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" />
      </svg>
    ),
  },
]

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme()

  return (
    <div
      className={`inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800 ${
        compact ? 'w-full' : ''
      }`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setTheme(option.value)}
          aria-pressed={theme === option.value}
          title={option.label}
          className={`flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
            compact ? 'flex-1 px-2 py-1.5' : 'px-3 py-1.5'
          } ${
            theme === option.value
              ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {option.icon}
          {!compact && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  )
}
