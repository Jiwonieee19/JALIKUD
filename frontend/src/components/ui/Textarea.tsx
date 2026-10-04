import { forwardRef, type TextareaHTMLAttributes } from 'react'

const base =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-red-600 dark:bg-slate-800 dark:text-white dark:ring-slate-700 dark:placeholder:text-slate-500 sm:text-sm'

const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...props }, ref) {
    return <textarea ref={ref} className={`${base} ${className}`} {...props} />
  },
)

export default Textarea
