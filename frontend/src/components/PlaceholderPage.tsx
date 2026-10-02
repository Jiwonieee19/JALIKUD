import type { ReactNode } from 'react'

interface Props {
  title: string
  description: string
  planned?: string[]
  children?: ReactNode
}

/**
 * Placeholder for screens that are designed but not built yet.
 *
 * Used by /admin/rewards, which has NO backend support at all — there is no
 * Reward model, no migration and no endpoint. See docs/API_WIRING.md.
 */
export default function PlaceholderPage({ title, description, planned, children }: Props) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </header>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7">
            <path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM10 5a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 10 5Zm1.25 9.25h-2.5V9h2.5v5.25Z" />
          </svg>
        </div>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Not implemented yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          This screen is a placeholder. The data model does not exist on the backend yet, so there is
          nothing to wire up until that work is done.
        </p>
        {planned && planned.length > 0 && (
          <div className="mx-auto mt-6 max-w-md rounded-xl bg-slate-50 p-4 text-left ring-1 ring-slate-200 ring-inset dark:bg-slate-800/50 dark:ring-slate-700">
            <p className="mb-2 text-xs font-extrabold tracking-wider text-slate-500 uppercase">
              Planned scope
            </p>
            <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              {planned.map((entry) => (
                <li key={entry} className="flex gap-2">
                  <span className="text-red-600 dark:text-red-400">•</span>
                  {entry}
                </li>
              ))}
            </ul>
          </div>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  )
}
