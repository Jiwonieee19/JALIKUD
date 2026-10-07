interface Props {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

/**
 * Labelled on/off switch, used for boolean state that has its own explanation
 * (store hours, order types, category visibility) rather than a bare checkbox.
 *
 * The input stays in the DOM as a real checkbox, visually hidden with `sr-only`,
 * so it remains keyboard reachable and form-associable via the wrapping label.
 */
export default function Toggle({ id, label, description, checked, onChange, disabled }: Props) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start justify-between gap-4 rounded-xl px-4 py-3 ring-1 ring-inset transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-50 ring-slate-200 dark:ring-slate-800'
          : 'cursor-pointer ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-800/50'
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900 dark:text-white">{label}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{description}</span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-red-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red-600 dark:bg-slate-700" />
        <span className="absolute top-0.5 left-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}