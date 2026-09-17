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
const BADGE_TAG = '#F59E0B';
const BADGE_DISCOUNT = '#FBBF24';
const ORANGE = '#EA580C';

type Deal = {
  id: string;
  title: string;
  description: string;
  includes: string[];
  price: number;
  oldPrice: number;
  discount: number;
  tag: string;
  expiry: string;
  expiryUrgent?: boolean;
  emoji: string;
};

// Static deals for now — will be replaced by the backend API later.
const DEALS: Deal[] = [
  {
    id: '1',
    title: 'Chickenjoy Family Bundle',
    description:
      '6pc Chickenjoy + 2 Steamed Rice + 2 Regular Fries + 2 Large Drinks. Great deal for the whole family!',
    includes: ['6pc Chickenjoy', '2 Steamed Rice', '2 Regular Fries', '2 Large Drinks'],
    price: 699,
    oldPrice: 999,
    discount: 22,
    tag: 'BESTSELLER',
    expiry: 'Ends Aug 31, 2026',
    emoji: '🍗',
  },
  {
    id: '2',
    title: 'Burger Steak Duo',
    description:
      'Two Burger Steaks smothered in mushroom gravy, paired with fries and drinks.',
    includes: ['2 Burger Steak', '2 Regular Fries', '2 Regular Drinks'],
    price: 449,
    oldPrice: 599,
    discount: 25,
    tag: 'LIMITED',
    expiry: 'Expiring soon!',
    expiryUrgent: true,
    emoji: '🍔',
  },
  {
    id: '3',
    title: 'Jolly Spaghetti Family Pan',
    description:
      'Family-size pan of our sweet-style Jolly Spaghetti with hotdog and cheese toppings.',
    includes: ['1 Family Pan', '6 Bread Sticks', 'Free Spoon Set'],
    price: 349,
    oldPrice: 409,
    discount: 15,
    tag: 'NEW',
    expiry: 'Ends Sep 15, 2026',
    emoji: '🍝',
  },
];

export default function DealsScreen() {
  const [added, setAdded] = useState<Set<string>>(new Set());

  const handleAddToCart = (deal: Deal) => {
    setAdded((prev) => new Set(prev).add(deal.id));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Red header: title + subtitle */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleIconBox}>
              <Text style={styles.titleIcon}>🏷️</Text>
            </View>
            <Text style={styles.title}>Deals &amp; Promos</Text>
          </View>
          <Text style={styles.subtitle}>Limited-time offers. Don&apos;t miss out!</Text>
        </View>
      </SafeAreaView>

      {/* Deal cards */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {DEALS.map((deal) => {
          const isAdded = added.has(deal.id);
          return (
            <View key={deal.id} style={styles.card}>
              {/* Image area with badges + overlaid title */}
              <View style={styles.cardImageWrap}>
                <View style={styles.badgeTagBox}>
                  <Text style={styles.badgeTagText}>{deal.tag}</Text>
                </View>
                <View style={styles.badgeDiscountBox}>
                  <Text style={styles.badgeDiscountText}>-{deal.discount}%</Text>
                </View>
                <Text style={styles.cardEmoji}>{deal.emoji}</Text>
                <View style={styles.cardTitleOverlay}>
                  <Text style={styles.cardTitle}>{deal.title}</Text>
                </View>
              </View>

              {/* Body */}
              <View style={styles.cardBody}>
                <Text style={styles.cardDescription}>{deal.description}</Text>

                <Text style={styles.includesLabel}>Includes:</Text>
                <View style={styles.chipsWrap}>
                  {deal.includes.map((item) => (
                    <View key={item} style={styles.chip}>
                      <Text style={styles.chipText}>{item}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.priceCol}>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>₱{deal.price}</Text>
                      <Text style={styles.oldPrice}>₱{deal.oldPrice}</Text>
                    </View>
                    <Text
                      style={[
                        styles.expiry,
                        deal.expiryUrgent && styles.expiryUrgent,
                      ]}>
                      ⏱ {deal.expiry}
                    </Text>
                  </View>

                  <Pressable
                    disabled={isAdded}
                    onPress={() => handleAddToCart(deal)}
                    style={({ pressed }) => [
                      styles.addCartButton,
                      isAdded && styles.addCartButtonDone,
                      pressed && !isAdded && styles.pressed,
                    ]}>
                    <Text style={styles.addCartText}>
                      {isAdded ? '✓ Added' : 'Add to Cart'}
                    </Text>
                  </Pressable>
                </View>
              </View>
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
    paddingBottom: 16,
    gap: 4,
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
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginLeft: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: BottomTabInset + 24,
  },
  pressed: {
    opacity: 0.8,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardImageWrap: {
    height: 170,
    backgroundColor: '#FDEBD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 76,
  },
  badgeTagBox: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: BADGE_TAG,
  },
  badgeTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  badgeDiscountBox: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: BADGE_DISCOUNT,
  },
  badgeDiscountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardTitleOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 14,
    gap: 10,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: TEXT_GRAY,
  },
  includesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F0F0F3',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  priceCol: {
    gap: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: RED,
  },
  oldPrice: {
    fontSize: 13,
    color: TEXT_GRAY,
    textDecorationLine: 'line-through',
  },
  expiry: {
    fontSize: 11,
    color: TEXT_GRAY,
  },
  expiryUrgent: {
    color: ORANGE,
    fontWeight: '700',
  },
  addCartButton: {
    backgroundColor: RED,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  addCartButtonDone: {
    backgroundColor: '#16A34A',
  },
  addCartText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

