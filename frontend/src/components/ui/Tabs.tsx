export interface TabOption<T extends string> {
  value: T
  label: string
  count?: number
}

interface Props<T extends string> {
  options: Array<TabOption<T>>
  value: T
  onChange: (value: T) => void
}

export default function Tabs<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div
      role="tablist"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${
              active
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800 dark:hover:bg-slate-800'
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
