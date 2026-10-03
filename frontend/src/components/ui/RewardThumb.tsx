import MenuThumb from './MenuThumb'
import type { Reward } from '../../types'

interface Props {
  reward: Reward
  /** Pass the menu item the reward gives away, if you already looked it up. */
  linkedItemImageUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Artwork for a reward.
 *
 * ⚠️ Rewards have NO image field, on the frontend type or the backend. There is
 * no `rewards` table at all yet (see docs/API_WIRING.md §4), and `emoji` on the
 * `Reward` type is a design-only field carried over from mobile
 * (mobile/src/app/(tabs)/rewards.tsx:33) — the reconstructed schema has no
 * `rewards.emoji` column either.
 *
 * So artwork is DERIVED, in priority order:
 *   1. the linked menu item's image — the only case with a real backing column
 *      (`menu_items.image_url`)
 *   2. the reward's own emoji tile, for vouchers which have no menu item
 *   3. MenuThumb's letter fallback
 *
 * TODO(next-dev): if rewards ever need their own artwork, add `image_url` to the
 * rewards table and check it here first. Nothing else needs to change.
 */
export default function RewardThumb({ reward, linkedItemImageUrl, size = 'md' }: Props) {
  const className =
    size === 'sm' ? 'h-9 w-9 rounded-lg text-base' : size === 'lg' ? 'h-16 w-16 rounded-2xl text-3xl' : 'h-12 w-12 rounded-xl text-xl'

  if (linkedItemImageUrl) {
    return <MenuThumb src={linkedItemImageUrl} name={reward.title} size={size} />
  }

  return (
    <span
      role="img"
      aria-label={reward.title}
      className={`flex shrink-0 items-center justify-center bg-amber-50 font-extrabold dark:bg-amber-500/10 ${className}`}
    >
      {reward.emoji ?? reward.title.trim().charAt(0).toUpperCase()}
    </span>
  )
}