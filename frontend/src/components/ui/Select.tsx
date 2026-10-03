import { forwardRef, type SelectHTMLAttributes } from 'react'

/**
 * `appearance-none` is essential here: without it the browser draws its OWN
 * native dropdown arrow on top of the custom chevron below, which reads as a
 * duplicated double arrow. `pr-9` reserves the room for the single chevron.
 */
const base =
  'block w-full appearance-none rounded-lg border-0 bg-white px-3 py-2 pr-9 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-red-600 dark:bg-slate-800 dark:text-white dark:ring-slate-700 dark:focus:ring-red-500 sm:text-sm'

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...props }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={`${base} ${className}`} {...props}>
          {children}
        </select>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  },
)

export default Select
