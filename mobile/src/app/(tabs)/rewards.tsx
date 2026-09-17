import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';

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
  },
  {
    id: '2',
    title: 'Free Yumburger',
    description: 'Redeem for one free classic Yumburger',
    points: 350,
    worth: 89,
    emoji: '🍔',
  },
  {
    id: '3',
    title: 'Free Regular Fries',
    description: 'Redeem for a free serving of Regular Fries',
    points: 200,
    worth: 79,
    emoji: '🍟',
  },
  {
    id: '4',
    title: '₱100 Off Voucher',
    description: 'Get ₱100 off your next order of ₱300 or more',
    points: 750,
    worth: 100,
    emoji: '🎫',
  },
  {
    id: '5',
    title: 'Free Peach Mango Pie',
    description: 'Redeem for a delicious free Peach Mango Pie',
    points: 150,
    worth: 45,
    emoji: '🥧',
  },
  {
    id: '6',
    title: 'Free Sundae Cup',
    description: 'Redeem for a free regular Sundae Cup',
    points: 100,
    worth: 39,
    emoji: '🍨',
  },
];

export default function RewardsScreen() {
  // Static points balance for now — will come from the backend API later.
  const [pointsBalance] = useState(2450);
  const [redeemed, setRedeemed] = useState<Set<string>>(new Set());

  const handleRedeem = (reward: Reward) => {
    setRedeemed((prev) => new Set(prev).add(reward.id));
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
          const isRedeemed = redeemed.has(reward.id);
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
                disabled={isRedeemed}
                onPress={() => handleRedeem(reward)}
                style={({ pressed }) => [
                  styles.redeemButton,
                  isRedeemed && styles.redeemButtonDone,
                  pressed && !isRedeemed && styles.pressed,
                ]}>
                <Text style={styles.redeemText}>{isRedeemed ? 'Redeemed' : 'Redeem'}</Text>
              </Pressable>
            </View>
          );
        })}
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
  redeemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.8,
  },
});

