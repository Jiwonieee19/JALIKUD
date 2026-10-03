import { useState } from 'react'

/**
 * Width ÷ height of /images/logo-mark.png.
 * The image already has transparent padding baked in, so the holder matches its
 * shape exactly and the artwork can never be cropped or squashed.
 */
const MARK_RATIO = 256 / 289

interface Props {
  /**
   * 'mark'  — the apple + hat graphic alone.
   * 'full'  — mark plus the JALIKUD wordmark set in the UI font.
   *
   * The supplied logo is a MARK, not a lockup, so 'full' renders the wordmark
   * as live text beside it — selectable, scalable, consistent with the app's type.
   */
  variant?: 'mark' | 'full'
  /** Any Tailwind HEIGHT class, e.g. 'h-9'. Width is derived — don't add w-*. */
  heightClass?: string
  /** Overrides `variant`. */
  showWordmark?: boolean
  className?: string
}

/**
 * Artwork: public/images/logo-mark.png, derived from the supplied
 * public/Jalikud-logo.png (157 KB, zero horizontal padding — the black outline
 * sat flush against the edges and looked cut off). The 21 KB derivative is
 * trimmed and padded.
 *
 * TO REPLACE: overwrite public/Jalikud-logo.png and ask for the derivative to be
 * regenerated. Nothing else needs to change.
 *
 * Colours in the artwork: red #D02C52, outline #272425. The UI accent is
 * #DC2626 — close but not identical. Neither was changed.
 */
export default function Logo({
  variant = 'full',
  heightClass = 'h-8',
  showWordmark,
  className = '',
}: Props) {
  const [failed, setFailed] = useState(false)
  const withWordmark = showWordmark ?? variant === 'full'

  const artwork = failed ? (
    <span
      role="img"
      aria-label="JALIKUD"
      className="flex h-full w-auto aspect-square shrink-0 items-center justify-center rounded-lg bg-red-600 font-black text-white"
    >
      J
    </span>
  ) : (
    <img
      src="/images/logo-mark.png"
      alt="JALIKUD"
      onError={() => setFailed(true)}
      // h-full fills the wrapper (sized by heightClass); aspect-ratio then fixes
      // the width to the artwork's shape. object-contain is belt-and-braces.
      style={{ aspectRatio: String(MARK_RATIO) }}
      className="h-full w-auto shrink-0 object-contain"
    />
  )

  return (
    <span
      className={`inline-flex items-center ${withWordmark ? 'gap-2.5' : ''} ${heightClass} ${className}`}
    >
      {artwork}
      {withWordmark && (
        <span className="text-xl font-extrabold tracking-wide text-slate-900 dark:text-white">
          JALIKUD
        </span>
      )}
    </span>
  )
}