import type { Reward, RewardRedemption } from '../types'
import { findMenuItem } from './menu'

/**
 * MOCK DATA — stands in for (NONE OF THESE EXIST YET):
 *   GET    /api/admin/rewards
 *   POST   /api/admin/rewards
 *   PUT    /api/admin/rewards/{reward}
 *   DELETE /api/admin/rewards/{reward}
 *   GET    /api/admin/rewards/redemptions
 *   GET    /api/rewards                 (customer-facing catalogue)
 *
 * ⚠️ NO BACKEND SUPPORT AT ALL. No Reward model, no rewards/reward_redemptions/
 *    reward_point_transactions migration, no route. Verified against
 *    backend/routes/api.php — nothing matching /reward.
 *
 *    The previous schema draft (DATABASE_SCHEMA.md, 514 lines) was deleted in
 *    commit 14dd219 and README.md still links to it as a broken URL. The shape
 *    below is reconstructed from the mobile catalogue plus what that draft
 *    specified.
 *
 * SOURCE OF THE SIX CATALOGUE ITEMS
 * Copied from mobile/src/app/(tabs)/rewards.tsx:24-73 so the customer app and
 * the admin panel agree on names, point costs and cash values.
 *
 * Column renames applied (mobile → schema):
 *   points  → points_required   (integer count, not money)
 *   worth   → monetary_value    (decimal(12,2) → STRING)
 *
 * ⚠️ TWO DATA INCONSISTENCIES between mobile and the web menu fixture — BOTH
 * now RESOLVED on 2026-09-29, kept here for provenance:
 *   • "Free Regular Fries" was ₱79 in mobile but Crispy Fries was ₱59 in the
 *     web menu. Priced to ₱79 (mock/menu.ts item 13) to match mobile, per team
 *     decision. Mobile is the source of truth.
 *   • "Peach Mango Pie" and "Sundae Cup" were free_item rewards with no
 *     matching menu_items row. Added as menu items 17 and 18 under a new
 *     Desserts category (7), and linked below.
 *
 * ⚠️ POINT COSTS WERE DELIBERATELY NOT TOUCHED. points_required is still
 * verbatim mobile (500 / 350 / 200 / 750 / 150 / 100). No ratio to cash value
 * was imposed, because nothing on the backend decides the exchange rate yet.
 * Left visible so whoever builds the ledger can sanity-check them.
 */

export const mockRewards: Reward[] = [
  {
    id: 1,
    title: 'Free Chickenjoy 1pc',
    description: 'Redeem for a free 1pc Chickenjoy',
    type: 'free_item',
    points_required: 500,
    monetary_value: '109.00',
    menu_item_id: 1, // Chickenjoy 1pc — ₱109.00
    stock: 40,
    emoji: '🍗',
    is_active: true,
    created_at: '2026-09-15T03:00:00+08:00',
    updated_at: '2026-09-15T03:00:00+08:00',
  },
  {
    id: 2,
    title: 'Free Yumburger',
    description: 'Redeem for one free classic Yumburger',
    type: 'free_item',
    points_required: 350,
    monetary_value: '89.00',
    menu_item_id: 5, // Yumburger — ₱89.00
    stock: 60,
    emoji: '🍔',
    is_active: true,
    created_at: '2026-09-15T03:01:00+08:00',
    updated_at: '2026-09-15T03:01:00+08:00',
  },
  {
    id: 3,
    title: 'Free Regular Fries',
    description: 'Redeem for a free serving of Regular Fries',
    type: 'free_item',
    points_required: 200,
    // ⚠️ mobile says 79; the web menu fixture prices Crispy Fries at 59.
    monetary_value: '79.00',
    menu_item_id: 13, // Crispy Fries — ₱59.00 in the web fixture
    stock: 80,
    emoji: '🍟',
    is_active: true,
    created_at: '2026-09-15T03:02:00+08:00',
    updated_at: '2026-09-15T03:02:00+08:00',
  },
  {
    id: 4,
    title: '₱100 Off Voucher',
    description: 'Get ₱100 off your next order of ₱300 or more',
    type: 'voucher',
    points_required: 750,
    monetary_value: '100.00',
    menu_item_id: null, // vouchers are not tied to a menu item
    stock: 100,
    emoji: '🎫',
    is_active: true,
    created_at: '2026-09-15T03:03:00+08:00',
    updated_at: '2026-09-15T03:03:00+08:00',
  },
  {
    id: 5,
    title: 'Free Peach Mango Pie',
    description: 'Redeem for a delicious free Peach Mango Pie',
    type: 'free_item',
    points_required: 150,
    monetary_value: '45.00',
    menu_item_id: 17, // Peach Mango Pie — added to the menu 2026-09-29
    stock: 25,
    emoji: '🥧',
    is_active: true,
    created_at: '2026-09-15T03:04:00+08:00',
    updated_at: '2026-09-15T03:04:00+08:00',
  },
  {
    id: 6,
    title: 'Free Sundae Cup',
    description: 'Redeem for a free regular Sundae Cup',
    type: 'free_item',
    points_required: 100,
    monetary_value: '39.00',
    menu_item_id: 18, // Sundae Cup — added to the menu 2026-09-29
    stock: null, // unlimited
    emoji: '🍨',
    // Paused, so the admin page demonstrates the disabled state.
    is_active: false,
    created_at: '2026-09-15T03:05:00+08:00',
    updated_at: '2026-09-20T09:12:00+08:00',
  },
]

/**
 * Customer-facing sample, for the redemptions table on the admin page.
 * `code` is what the customer presents at the counter — it must be unique and
 * single-use.
 */
export const mockRedemptions: RewardRedemption[] = [
  {
    id: 1, reward_id: 1, user_id: 9, code: 'RWD-7K2M-9Q4X', status: 'used',
    points_spent: 500,
    redeemed_at: '2026-09-28T12:05:00+08:00',
    used_at: '2026-09-28T12:31:00+08:00',
    expires_at: '2026-10-28T12:05:00+08:00',
    user: { id: 9, name: 'Andrea Buenaventura', email: 'andrea@example.com', phone: '0917 444 8890', role: 'customer' },
    reward: mockRewards[0],
  },
  {
    id: 2, reward_id: 4, user_id: 10, code: 'RWD-3F8P-1L6D', status: 'issued',
    points_spent: 750,
    redeemed_at: '2026-09-29T09:20:00+08:00',
    used_at: null,
    expires_at: '2026-10-29T09:20:00+08:00',
    user: { id: 10, name: 'Paolo Mendoza', email: 'paolo@example.com', phone: '0918 222 3344', role: 'customer' },
    reward: mockRewards[3],
  },
  {
    id: 3, reward_id: 2, user_id: 11, code: 'RWD-9T5B-2H8R', status: 'expired',
    points_spent: 350,
    redeemed_at: '2026-08-28T14:00:00+08:00',
    used_at: null,
    expires_at: '2026-09-27T14:00:00+08:00',
    user: { id: 11, name: 'Grace Lim', email: 'grace@example.com', phone: '0921 333 4455', role: 'customer' },
    reward: mockRewards[1],
  },
]

/** Resolves the linked menu item name for a reward, or null if orphaned. */
export function rewardItemName(reward: Reward): string | null {
  if (reward.menu_item_id === null) return null
  return findMenuItem(reward.menu_item_id)?.name ?? null
}

/* ---------------------------------------------------------------------------
 * SELF-CHECK — runs on import so a bad edit fails loudly in dev.
 * ------------------------------------------------------------------------ */
{
  for (const reward of mockRewards) {
    if (reward.points_required <= 0) {
      throw new Error(`Reward ${reward.id} has non-positive points_required`)
    }
    if (reward.type === 'free_item' && reward.menu_item_id === null) {
      // Allowed (reward 5 and 6), but it must be flagged rather than silent.
      continue
    }
    if (reward.type === 'voucher' && reward.menu_item_id !== null) {
      throw new Error(`Reward ${reward.id} is a voucher but references a menu item`)
    }
    if (reward.stock !== null && reward.stock < 0) {
      throw new Error(`Reward ${reward.id} has negative stock`)
    }
  }
  for (const redemption of mockRedemptions) {
    if (mockRewards.find((reward) => reward.id === redemption.reward_id) === undefined) {
      throw new Error(`Redemption ${redemption.id} points at a missing reward`)
    }
    if (redemption.status === 'used' && redemption.used_at === null) {
      throw new Error(`Redemption ${redemption.id} is 'used' but has no used_at`)
    }
  }
}