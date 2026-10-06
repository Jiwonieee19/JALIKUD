import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useCustomerOrder } from '@/context/customer-order-context';

const RED = '#DC2626';
const BG = '#F4F4F6';
const CARD = '#FFFFFF';
const TEXT_DARK = '#1C1C1E';
const TEXT_GRAY = '#8E8E93';

type Reward = {
  id: string;
  title: string;
  description: string;
  points: number;
  worth: number;
  emoji: string;
  type: 'free_item' | 'voucher';
  cartName?: string;
};

// Static rewards for now — will be replaced by the backend API later.
const REWARDS: Reward[] = [
  {
    id: '1',
    title: 'Free Chickenjoy 1pc',
    description: 'Redeem for a free 1pc Chickenjoy (worth ₱109)',
    points: 500,
    worth: 109,
    emoji: '🍗',
    type: 'free_item',
    cartName: 'Chickenjoy 1pc',
  },
  {
    id: '2',
    title: 'Free Yumburger',
    description: 'Redeem for one free classic Yumburger',
    points: 350,
    worth: 89,
    emoji: '🍔',
    type: 'free_item',
    cartName: 'Yumburger',
  },
  {
    id: '3',
    title: 'Free Regular Fries',
    description: 'Redeem for a free serving of Regular Fries',
    points: 200,
    worth: 79,
    emoji: '🍟',
    type: 'free_item',
    cartName: 'Regular Fries',
  },
  {
    id: '4',
    title: '₱100 Off Voucher',
    description: 'Get ₱100 off your next order of ₱300 or more',
    points: 750,
    worth: 100,
    emoji: '🎫',
    type: 'voucher',
  },
  {
    id: '5',
    title: 'Free Peach Mango Pie',
    description: 'Redeem for a delicious free Peach Mango Pie',
    points: 150,
    worth: 45,
    emoji: '🥧',
    type: 'free_item',
    cartName: 'Peach Mango Pie',
  },
  {
    id: '6',
    title: 'Free Sundae Cup',
    description: 'Redeem for a free regular Sundae Cup',
    points: 100,
    worth: 39,
    emoji: '🍨',
    type: 'free_item',
    cartName: 'Sundae Cup',
  },
];

export default function RewardsScreen() {
  const router = useRouter();
  const { addToCart, pointsBalance, pointsHistory, redeemedRewardIds, redeemReward } = useCustomerOrder();

  const handleRedeem = (reward: Reward) => {
    if (redeemedRewardIds.has(reward.id) || reward.points > pointsBalance) return;

    const remainingPoints = pointsBalance - reward.points;
    const destinationMessage =
      reward.type === 'free_item'
        ? 'The free item will be added to your cart.'
        : 'The voucher will be saved for later use.';

    Alert.alert(
      'Confirm Redemption',
      `${reward.title}\n\nRedeem for ${reward.points.toLocaleString('en-PH')} points?\nRemaining balance: ${remainingPoints.toLocaleString('en-PH')} points\n\n${destinationMessage}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Redeem',
          onPress: () => {
            if (!redeemReward(reward.id, reward.points)) return;

            if (reward.type === 'free_item' && reward.cartName) {
              addToCart({
                id: `reward-${reward.id}`,
                name: reward.cartName,
                unitPrice: 0,
                emoji: reward.emoji,
                variant: 'Redeemed Reward',
                source: 'reward',
                maxQuantity: 1,
              });
              router.replace('/(tabs)/cart');
              setTimeout(
                () => Alert.alert('Reward Redeemed', `${reward.cartName} was added to your cart.`),
                250,
              );
              return;
            }

            setTimeout(
              () => Alert.alert('Voucher Redeemed', `${reward.title} was saved for later use.`),
              250,
            );
          },
        },
      ],
    );
  };

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
                {pointsBalance.toLocaleString('en-PH')}
              </Text>
              <Text style={styles.balanceUnit}>pts</Text>
            </View>
            <Text style={styles.balanceHint}>⭐ Earn 1 point for every ₱10 spent</Text>
            <Text style={styles.balanceSubHint}>Points are credited when your order is delivered</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Available rewards list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>AVAILABLE REWARDS</Text>

        {REWARDS.map((reward) => {
          const isRedeemed = redeemedRewardIds.has(reward.id);
          const cannotAfford = reward.points > pointsBalance;
          return (
            <View key={reward.id} style={styles.card}>
              <View style={styles.cardImageBox}>
                <Text style={styles.cardEmoji}>{reward.emoji}</Text>
              </View>

              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {reward.title}
                </Text>
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {reward.description}
                </Text>
                <View style={styles.cardPointsRow}>
                  <Text style={styles.cardPoints}>⭐ {reward.points} pts</Text>
                  <Text style={styles.cardWorth}> · worth ₱{reward.worth}</Text>
                </View>
              </View>

              <Pressable
                disabled={isRedeemed || cannotAfford}
                onPress={() => handleRedeem(reward)}
                style={({ pressed }) => [
                  styles.redeemButton,
                  isRedeemed && styles.redeemButtonDone,
                  cannotAfford && styles.redeemButtonDisabled,
                  pressed && !isRedeemed && !cannotAfford && styles.pressed,
                ]}>
                <Text style={styles.redeemText}>
                  {isRedeemed ? 'Redeemed' : cannotAfford ? 'Not enough points' : 'Redeem'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {pointsHistory.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, styles.historyTitle]}>POINTS HISTORY</Text>
            {pointsHistory.map((entry) => (
              <View key={entry.id} style={styles.historyCard}>
                <Text style={styles.historyIcon}>{entry.kind === 'earned' ? '⭐' : '🎁'}</Text>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyLabel}>{entry.label}</Text>
                  <Text style={styles.historyDate}>{entry.date}</Text>
                </View>
                <Text style={[styles.historyPoints, entry.kind === 'redeemed' && styles.historySpent]}>
                  {entry.kind === 'earned' ? '+' : '−'}
                  {entry.points.toLocaleString('en-PH')} pts
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
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
  cardWorth: {
    fontSize: 12,
    color: TEXT_GRAY,
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

