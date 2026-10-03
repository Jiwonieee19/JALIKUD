import type { ReactNode } from 'react'

interface Props {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

export default function Card({ title, description, action, className = '', children }: Props) {
  return (
    <section
      className={`rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 ${className}`}
    >
      {(title || description || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
