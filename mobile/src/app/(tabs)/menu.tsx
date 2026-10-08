import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useCustomerOrder } from '@/context/customer-order-context';
import { assetUrl, errorMessage } from '@/lib/api';
import { customerApi, type MenuItem as ApiMenuItem, type StoreSetting } from '@/lib/customer-api';

const RED = '#DC2626';
const BG = '#F4F4F6';
const CARD = '#FFFFFF';
const TEXT_DARK = '#1C1C1E';
const TEXT_GRAY = '#8E8E93';
const BADGE_GREEN = '#16A34A';
const BADGE_AMBER = '#F59E0B';

type Category = { id: number | null; name: string };

type MenuItem = {
  id: number;
  name: string;
  price: number;
  oldPrice?: number;
  categoryId: number;
  isNew?: boolean;
  emoji: string;
  imageUrl?: string;
  description?: string;
};

function emojiFor(item: ApiMenuItem): string {
  const value = item.name.toLowerCase();
  if (value.includes('burger')) return '🍔';
  if (value.includes('spaghetti') || value.includes('pasta')) return '🍝';
  if (value.includes('fries')) return '🍟';
  if (value.includes('rice')) return '🍚';
  return '🍗';
}

function discountPercent(item: MenuItem): number | null {
  if (!item.oldPrice || item.oldPrice <= item.price) return null;
  return Math.round((1 - item.price / item.oldPrice) * 100);
}

// The first screen a customer sees after logging in.
export default function HomeScreen() {
  const { addToCart, quantityInCart, mutating } = useCustomerOrder();
  const [categories, setCategories] = useState<Category[]>([{ id: null, name: 'All' }]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [store, setStore] = useState<StoreSetting | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCatalog = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const catalog = await customerApi.catalog();
      setStore(catalog.store);
      setCategories([{ id: null, name: 'All' }, ...catalog.categories.map(({ id, name }) => ({ id, name }))]);
      setMenu(catalog.menuItems
        .filter((item) => item && Number.isFinite(Number(item.id)) && typeof item.name === 'string')
        .map((item) => ({
          id: Number(item.id),
          name: item.name,
          price: Number(item.base_price) || 0,
          categoryId: Number(item.category?.id ?? item.category_id),
          isNew: Boolean(item.is_featured),
          emoji: emojiFor(item),
          imageUrl: assetUrl(item.image_url) ?? undefined,
          description: item.description || undefined,
        })));
    } catch (caught) {
      setLoadError(errorMessage(caught, 'The menu server is currently unavailable.'));
    } finally {
      setLoading(false);
    }
  };

  // Initial public catalog synchronization is the purpose of this screen effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadCatalog(); }, []);

  const items = menu.filter((item) => {
    const matchesCategory = activeCategory === null || item.categoryId === activeCategory;
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
                  {store?.store_name ?? 'Jalikud'}
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadCatalog()} tintColor={RED} />}
        showsVerticalScrollIndicator={false}>
        {/* Promo banner */}
        <Pressable style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
          <View style={styles.bannerEmojiBackdrop}>
            <Text style={styles.bannerEmoji}>🍗</Text>
          </View>
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerKicker}>LIVE MENU</Text>
            <Text style={styles.bannerTitle}>{store?.store_name ?? 'Jalikud'}</Text>
            <Text style={styles.bannerSubtitle}>{store?.is_open ? 'Open now · Browse available items' : 'The store is currently closed'}</Text>
          </View>
        </Pressable>


        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsRow}>
          {categories.map((category) => {
            const selected = category.id === activeCategory;
            return (
              <Pressable
                key={category.id ?? 'all'}
                onPress={() => setActiveCategory(category.id)}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {category.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Product grid */}
        <View style={styles.grid}>
          {loading && menu.length === 0 && <ActivityIndicator style={styles.loader} size="large" color={RED} />}
          {items.map((item) => {
            const discount = discountPercent(item);
            const cartQuantity = quantityInCart(item.id);
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
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.cardImage} contentFit="cover" transition={150} />
                  ) : (
                    <Text style={styles.cardEmoji}>{item.emoji}</Text>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.description && <Text style={styles.cardDescription} numberOfLines={2}>{item.description}</Text>}
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>₱{item.price}</Text>
                    {item.oldPrice != null && <Text style={styles.oldPrice}>₱{item.oldPrice}</Text>}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.name} to cart`}
                    disabled={mutating}
                    onPress={() => void addToCart({
                        id: item.id,
                        name: item.name,
                        unitPrice: item.price,
                        emoji: item.emoji,
                      }).catch(() => undefined)}
                    style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
                    <Text style={styles.addButtonText}>{cartQuantity > 0 ? cartQuantity : '+'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {!loading && items.length === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{loadError || 'No menu items found.'}</Text>
              {!!loadError && <Pressable onPress={() => void loadCatalog()} style={styles.retryButton}><Text style={styles.retryText}>Try Again</Text></Pressable>}
            </View>
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
  chipsScroll: {
    flexGrow: 0,
  },
  chipsRow: {
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 13,
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
    fontSize: 12,
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
  cardImage: {
    width: '100%',
    height: '100%',
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
  cardDescription: {
    minHeight: 30,
    marginTop: 3,
    fontSize: 11,
    color: TEXT_GRAY,
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
  emptyWrap: { width: '100%', alignItems: 'center', paddingVertical: 28, gap: 12 },
  retryButton: { backgroundColor: RED, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '800' },
  loader: { width: '100%', paddingVertical: 48 },
});

