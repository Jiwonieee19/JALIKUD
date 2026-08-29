import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';

const RED = '#DC2626';
const BG = '#F4F4F6';
const CARD = '#FFFFFF';
const TEXT_DARK = '#1C1C1E';
const TEXT_GRAY = '#8E8E93';
const BADGE_GREEN = '#16A34A';
const BADGE_AMBER = '#F59E0B';

const CATEGORIES = ['All', 'Chickenjoy', 'Burgers', 'Rice Meals', 'Pasta'] as const;
type Category = (typeof CATEGORIES)[number];

type MenuItem = {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  category: Exclude<Category, 'All'>;
  isNew?: boolean;
  emoji: string;
};

// Static menu data for now — will be replaced by the backend API later.
const MENU: MenuItem[] = [
  { id: '1', name: 'Chickenjoy 1pc', price: 109, category: 'Chickenjoy', emoji: '🍗' },
  {
    id: '2',
    name: 'Chickenjoy 2pc',
    price: 199,
    oldPrice: 221,
    category: 'Chickenjoy',
    emoji: '🍗',
  },
  {
    id: '3',
    name: 'Chickenjoy 6pc',
    price: 549,
    category: 'Chickenjoy',
    isNew: true,
    emoji: '🍗',
  },
  { id: '4', name: 'Yumburger', price: 89, category: 'Burgers', emoji: '🍔' },
  {
    id: '5',
    name: 'Burger Steak',
    price: 139,
    oldPrice: 165,
    category: 'Rice Meals',
    emoji: '🍔',
  },
  {
    id: '6',
    name: 'Champ Burger',
    price: 179,
    category: 'Burgers',
    isNew: true,
    emoji: '🍔',
  },
  { id: '7', name: '1pc Burger Steak Solo', price: 99, category: 'Rice Meals', emoji: '🍚' },
  {
    id: '8',
    name: 'Chicken & Burger Combo',
    price: 249,
    oldPrice: 285,
    category: 'Burgers',
    emoji: '🍟',
  },
  { id: '9', name: 'Jolly Spaghetti', price: 99, category: 'Pasta', emoji: '🍝' },
  { id: '10', name: 'Chickenjoy 8pc Family', price: 729, category: 'Chickenjoy', emoji: '🍗' },
];

function discountPercent(item: MenuItem): number | null {
  if (!item.oldPrice || item.oldPrice <= item.price) return null;
  return Math.round((1 - item.price / item.oldPrice) * 100);
}

// The first screen a customer sees after logging in.
export default function HomeScreen() {
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [search, setSearch] = useState('');

  const items = MENU.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Red header: delivery location + search */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.deliveringTo}>Delivering to</Text>
              <View style={styles.locationRow}>
                <Text style={styles.locationIcon}>🏪</Text>
                <Text style={styles.locationName} numberOfLines={1}>
                  SM Lanang Premier
                </Text>
              </View>
            </View>
            <Pressable style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}>
              <Text style={styles.bellIcon}>🔔</Text>
              <View style={styles.bellDot} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search menu..."
              placeholderTextColor="#B3B3BA"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>
        </View>
      </SafeAreaView>

      {/* Scrollable content: promo banner, category chips, product grid */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Promo banner */}
        <Pressable style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
          <View style={styles.bannerEmojiBackdrop}>
            <Text style={styles.bannerEmoji}>🍗</Text>
          </View>
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerKicker}>TODAY ONLY</Text>
            <Text style={styles.bannerTitle}>Chickenjoy 2pc</Text>
            <Text style={styles.bannerSubtitle}>Save ₱22 · Use code JALI50</Text>
          </View>
        </Pressable>


        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}>
          {CATEGORIES.map((category) => {
            const selected = category === activeCategory;
            return (
              <Pressable
                key={category}
                onPress={() => setActiveCategory(category)}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Product grid */}
        <View style={styles.grid}>
          {items.map((item) => {
            const discount = discountPercent(item);
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardImageWrap}>
                  {discount !== null && (
                    <View style={[styles.badge, { backgroundColor: BADGE_AMBER }]}>
                      <Text style={styles.badgeText}>-{discount}%</Text>
                    </View>
                  )}
                  {item.isNew && (
                    <View style={[styles.badge, { backgroundColor: BADGE_GREEN }]}>
                      <Text style={styles.badgeText}>NEW</Text>
                    </View>
                  )}
                  <Text style={styles.cardEmoji}>{item.emoji}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>₱{item.price}</Text>
                    {item.oldPrice != null && <Text style={styles.oldPrice}>₱{item.oldPrice}</Text>}
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                    <Text style={styles.addButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {items.length === 0 && (
            <Text style={styles.emptyText}>No items found. Try another search.</Text>
          )}
        </View>
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
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  deliveringTo: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  locationIcon: {
    fontSize: 14,
  },
  locationName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: {
    fontSize: 18,
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_DARK,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: BottomTabInset + 24,
  },
  pressed: {
    opacity: 0.8,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#3E2723',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 120,
  },
  bannerEmojiBackdrop: {
    position: 'absolute',
    right: -10,
    top: -10,
    bottom: -10,
    width: 150,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  bannerEmoji: {
    fontSize: 72,
  },
  bannerTextWrap: {
    flex: 1,
    padding: 16,
    gap: 4,
  },
  bannerKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#FDE047',
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  chipsRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#E4E4E9',
  },
  chipSelected: {
    backgroundColor: RED,
    borderColor: RED,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  card: {
    width: '48.5%',
    marginBottom: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardImageWrap: {
    height: 120,
    backgroundColor: '#FDEBD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 56,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 10,
    paddingBottom: 14,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DARK,
    minHeight: 34,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: RED,
  },
  oldPrice: {
    fontSize: 12,
    color: TEXT_GRAY,
    textDecorationLine: 'line-through',
  },
  addButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyText: {
    width: '100%',
    textAlign: 'center',
    marginTop: 32,
    fontSize: 14,
    color: TEXT_GRAY,
  },
});

