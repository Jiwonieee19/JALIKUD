import type { ReactNode } from 'react'

interface Props {
  title?: string
  description?: string
  children: ReactNode
}

export default function Card({ title, description, children }: Props) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      {(title || description) && (
        <header className="mb-4">
          {title && (
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
          )}
          {description && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </header>
      )}
      {children}
    </section>
  )
}
