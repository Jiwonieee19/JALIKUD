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
 * The `rewards` table (migration 2026_10_08_000002) has no `image_url` and no
 * `emoji` column — only `menu_item_id`. So artwork is DERIVED, in priority order:
 *   1. the linked menu item's image, passed in as `linkedItemImageUrl`
 *   2. a letter tile from the reward's label
 *
 * `GET /api/admin/rewards` eager-loads `menuItem:id,name,slug` with no
 * `image_url`, so the caller has to source that separately from `GET /api/menu`.
 * Vouchers have no menu item and therefore always fall through to the letter.
 *
 * If rewards ever need their own artwork, add `image_url` to the rewards table
 * and check it here first. Nothing else needs to change.
 */
export default function RewardThumb({ reward, linkedItemImageUrl, size = 'md' }: Props) {
  const className =
    size === 'sm' ? 'h-9 w-9 rounded-lg text-base' : size === 'lg' ? 'h-16 w-16 rounded-2xl text-3xl' : 'h-12 w-12 rounded-xl text-xl'

  if (linkedItemImageUrl) {
    return <MenuThumb src={linkedItemImageUrl} name={reward.label} size={size} />
  }

  return (
    <span
      role="img"
      aria-label={reward.label}
      className={`flex shrink-0 items-center justify-center bg-amber-50 font-extrabold dark:bg-amber-500/10 ${className}`}
    >
      {reward.label.trim().charAt(0).toUpperCase()}
    </span>
  )
}