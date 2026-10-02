import PlaceholderPage from '../components/PlaceholderPage'

/**
 * Rewards / redemption points — PLACEHOLDER.
 *
 * ⚠️ NO BACKEND SUPPORT EXISTS.
 *   - No Reward model in backend/app/Models
 *   - No rewards/reward_redemptions/reward_point_transactions migration
 *   - No /api/admin/rewards endpoint
 *
 * `backend/DATABASE_SCHEMA.md` designs this (rewards, reward_redemptions,
 * reward_point_transactions with 1 point per PHP 10 spent), but none of it is
 * built. See docs/API_WIRING.md → "Endpoints that do not exist yet".
 *
 * TODO(next-dev): once the backend ships these three tables, replace this file
 * with a real page and add types for Reward / RewardRedemption /
 * RewardPointTransaction to src/types.ts.
 */
export default function AdminRewardsPage() {
  return (
    <PlaceholderPage
      title="Rewards & redemption"
      description="Point accrual and redemption for loyal customers. Named in the project proposal but not yet modelled on the backend."
      planned={[
        'Accrue 1 point per ₱10 spent, ledger-only (append-only)',
        'Rewards catalogue with points_required, stock and monetary_value',
        'Redemption codes with status lifecycle and per-user limits',
        'Lock the points balance against concurrent overspending',
      ]}
    />
  )
}
