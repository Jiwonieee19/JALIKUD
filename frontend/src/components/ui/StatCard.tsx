import type { ReactNode } from 'react'

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral'

interface Props {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  tone?: Tone
}

const tones: Record<Tone, { card: string; value: string }> = {
  brand: {
    card: 'ring-red-200 bg-gradient-to-br from-red-50 to-white dark:ring-red-500/25 dark:from-red-500/10 dark:to-slate-900',
    value: 'text-red-700 dark:text-red-400',
  },
  success: {
    card: 'ring-green-200 bg-gradient-to-br from-green-50 to-white dark:ring-green-500/25 dark:from-green-500/10 dark:to-slate-900',
    value: 'text-green-700 dark:text-green-400',
  },
  warning: {
    card: 'ring-amber-200 bg-gradient-to-br from-amber-50 to-white dark:ring-amber-500/25 dark:from-amber-500/10 dark:to-slate-900',
    value: 'text-amber-700 dark:text-amber-400',
  },
  danger: {
    card: 'ring-red-200 bg-gradient-to-br from-red-50 to-white dark:ring-red-500/25 dark:from-red-500/10 dark:to-slate-900',
    value: 'text-red-700 dark:text-red-400',
  },
  neutral: {
    card: 'ring-slate-200 bg-white dark:ring-slate-800 dark:bg-slate-900',
    value: 'text-slate-900 dark:text-white',
  },
}

export default function StatCard({ label, value, hint, icon, tone = 'neutral' }: Props) {
  const palette = tones[tone]
  return (
    <div className={`rounded-2xl p-5 shadow-sm ring-1 ring-inset ${palette.card}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-extrabold tracking-wider text-slate-500 uppercase dark:text-slate-400">
          {label}
        </p>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <p className={`mt-2 text-3xl font-extrabold tracking-tight tabular-nums ${palette.value}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  )
}
