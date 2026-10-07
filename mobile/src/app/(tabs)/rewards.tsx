import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useCustomerOrder } from '@/context/customer-order-context';
import { errorMessage } from '@/lib/api';
import { customerApi, type PointEntry, type Reward } from '@/lib/customer-api';

const RED = '#DC2626';
const BG = '#F4F4F6';
const CARD = '#FFFFFF';
const TEXT_DARK = '#1C1C1E';
const TEXT_GRAY = '#8E8E93';

const EMOJI: Record<string, string> = {
  'chickenjoy-1pc': '🍗',
  yumburger: '🍔',
  'voucher-100': '🎫',
};

function describe(reward: Reward): string {
  if (reward.type === 'free_item') {
    const price = reward.menu_item ? ` (worth ₱${Number(reward.menu_item.base_price)})` : '';
    return `Redeem for ${reward.label}${price}`;
  }
  return `${reward.label} on orders of ₱${Number(reward.min_order_amount ?? 0)} or more`;
}

function historyKind(reason: PointEntry['reason']): 'earned' | 'redeemed' {
  return reason === 'earned' ? 'earned' : 'redeemed';
}

export default function RewardsScreen() {
  const { token } = useAuth();
  const { cart, addToCart, quantityInCart, selectReward, clearReward, refreshCart, mutating } = useCustomerOrder();
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [history, setHistory] = useState<PointEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [cardError, setCardError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const [catalog, ledger] = await Promise.all([customerApi.rewards(token), customerApi.points(token)]);
      setRewards(catalog.data.rewards);
      setBalance(ledger.data.balance);
      setHistory(ledger.data.history);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load rewards.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void load().catch(() => undefined); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([load(), refreshCart()]).catch(() => undefined).finally(() => setRefreshing(false));
  }, [load, refreshCart]);

  const redeem = (reward: Reward) => {
    if (!token || busyKey !== null || mutating) return;
    setBusyKey(reward.key);
    setCardError((previous) => ({ ...previous, [reward.key]: '' }));
    (async () => {
      try {
        if (reward.type === 'free_item' && reward.menu_item) {
          if (quantityInCart(reward.menu_item.id) === 0) {
            await addToCart({ id: reward.menu_item.id, name: reward.menu_item.name });
          }
          await selectReward(reward.key);
        } else if (reward.type === 'voucher') {
          await selectReward(reward.key);
        }
        await Promise.all([refreshCart(), load()]);
      } catch (caught) {
        setCardError((previous) => ({
          ...previous,
          [reward.key]: errorMessage(caught, 'Could not redeem this reward.'),
        }));
      } finally {
        setBusyKey(null);
      }
    })();
  };

  const unselect = (rewardKey: string) => {
    if (busyKey !== null || mutating) return;
    setBusyKey(rewardKey);
    clearReward()
      .then(() => Promise.all([refreshCart(), load()]))
      .catch((caught: unknown) => {
        setCardError((previous) => ({
          ...previous,
          [rewardKey]: errorMessage(caught, 'Could not remove this reward.'),
        }));
      })
      .finally(() => setBusyKey(null));
  };

  const selectedKey = cart?.reward_key ?? null;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Red header: title + points balance card */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleIconBox}>
              <Text style={styles.titleIcon}>🎁</Text>
            </View>
            <Text style={styles.title}>Rewards</Text>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Your Points Balance</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceValue}>
                {balance.toLocaleString('en-PH')}
              </Text>
              <Text style={styles.balanceUnit}>pts</Text>
            </View>
            <Text style={styles.balanceHint}>⭐ Earn 1 point for every ₱10 spent</Text>
            <Text style={styles.balanceSubHint}>Points are credited when your order is completed and paid</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Available rewards list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}>
        <Text style={styles.sectionTitle}>AVAILABLE REWARDS</Text>

        {loading && rewards.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={RED} size="large" />
            <Text style={styles.loadingText}>Loading rewards…</Text>
          </View>
        ) : null}
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {error}</Text>
            <Pressable onPress={onRefresh} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        )}

        {rewards.map((reward) => {
          const selected = selectedKey === reward.key;
          const usable = reward.is_available && reward.can_afford;
          const busy = busyKey === reward.key;
          return (
            <View key={reward.key}>
              <View style={styles.card}>
                <View style={styles.cardImageBox}>
                  <Text style={styles.cardEmoji}>{EMOJI[reward.key] ?? '🎁'}</Text>
                </View>

                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {reward.label}
                  </Text>
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {describe(reward)}
                  </Text>
                  <View style={styles.cardPointsRow}>
                    <Text style={styles.cardPoints}>⭐ {reward.points_cost} pts</Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={selected ? `Remove ${reward.label}` : `Redeem ${reward.label}`}
                  disabled={!selected && (!usable || busy || mutating)}
                  onPress={() => (selected ? unselect(reward.key) : redeem(reward))}
                  style={({ pressed }) => [
                    styles.redeemButton,
                    selected && styles.redeemButtonDone,
                    !selected && !usable && styles.redeemButtonDisabled,
                    pressed && (selected || usable) && styles.pressed,
                  ]}>
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.redeemText}>
                      {selected ? 'Selected ✓' : !reward.is_available ? 'Unavailable' : !reward.can_afford ? `${reward.points_cost} pts` : 'Redeem'}
                    </Text>
                  )}
                </Pressable>
              </View>
              {!!cardError[reward.key] && <Text style={styles.cardError}>⚠ {cardError[reward.key]}</Text>}
            </View>
          );
        })}

        {history.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, styles.historyTitle]}>POINTS HISTORY</Text>
            {history.map((entry) => (
              <View key={entry.id} style={styles.historyCard}>
                <Text style={styles.historyIcon}>{historyKind(entry.reason) === 'earned' ? '⭐' : '🎁'}</Text>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyLabel}>{entry.description ?? entry.reason}</Text>
                  <Text style={styles.historyDate}>
                    {new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.created_at))}
                    {entry.order ? ` · ${entry.order.order_number}` : ''}
                  </Text>
                </View>
                <Text style={[styles.historyPoints, historyKind(entry.reason) === 'redeemed' && styles.historySpent]}>
                  {entry.points_delta > 0 ? '+' : ''}
                  {entry.points_delta.toLocaleString('en-PH')} pts
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  headerSafe: {
    backgroundColor: RED,
  },
  header: {
    backgroundColor: RED,
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleIcon: {
    fontSize: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  balanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  balanceUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  balanceHint: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  balanceSubHint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: BottomTabInset + 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: TEXT_GRAY,
    marginBottom: 10,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  errorBox: {
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 10,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: RED,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  cardError: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '700',
    marginTop: -6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  cardImageBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FDEBD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 30,
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  cardDescription: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  cardPointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  cardPoints: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  redeemButton: {
    backgroundColor: RED,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  redeemButtonDone: {
    backgroundColor: '#16A34A',
  },
  redeemButtonDisabled: {
    backgroundColor: '#A1A1AA',
  },
  redeemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historyTitle: { marginTop: 8 },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  historyIcon: { fontSize: 20 },
  historyInfo: { flex: 1, gap: 2 },
  historyLabel: { fontSize: 13, fontWeight: '700', color: TEXT_DARK },
  historyDate: { fontSize: 11, color: TEXT_GRAY },
  historyPoints: { fontSize: 13, fontWeight: '800', color: '#16A34A' },
  historySpent: { color: RED },
  pressed: {
    opacity: 0.8,
  },
});
