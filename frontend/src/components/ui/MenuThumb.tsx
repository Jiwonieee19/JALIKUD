import { useState } from 'react'

interface Props {
  /** Whatever `image_url` holds. Placeholder path now, real URL after backend. */
  src: string | null
  /** Used for the letter fallback and the alt text. */
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-9 w-9 rounded-lg',
  md: 'h-12 w-12 rounded-xl',
  lg: 'h-16 w-16 rounded-2xl',
}

/**
 * Menu-item thumbnail.
 *
 * Handles the three states that actually occur:
 *   1. image_url set        → renders it
 *   2. image_url null       → tinted tile with the item's first letter
 *   3. image_url set but 404 → falls back to (2) via onError
 *
 * Case 3 matters: the fixtures point at generated placeholders, and a real
 * deployment will point at uploaded files that may not exist yet. A broken
 * image icon would look like a bug; a neutral tile does not.
 *
 * TODO(next-dev): once real photography exists this component needs no change.
 */
export default function MenuThumb({ src, name, size = 'md', className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const showImage = src !== null && !failed

  if (showImage) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${sizes[size]} shrink-0 bg-slate-100 object-cover dark:bg-slate-800 ${className}`}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={`${sizes[size]} flex shrink-0 items-center justify-center bg-slate-100 font-extrabold text-slate-400 dark:bg-slate-800 dark:text-slate-500 ${className}`}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}