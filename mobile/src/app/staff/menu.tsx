import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { errorMessage } from '@/lib/api';
import { staffApi, type StaffMenuItem } from '@/lib/staff-api';

const RED = '#DC2626';
const BG = '#F4F4F6';
const TEXT = '#1C1C1E';
const GRAY = '#74747C';

function peso(value: number): string {
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function emojiFor(name: string): string {
  const value = name.toLowerCase();
  if (value.includes('burger')) return '🍔';
  if (value.includes('spaghetti') || value.includes('pasta')) return '🍝';
  if (value.includes('fries')) return '🍟';
  if (value.includes('rice')) return '🍚';
  return '🍗';
}

export default function StaffMenuScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<StaffMenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [menu, cats] = await Promise.all([staffApi.menu(), staffApi.categories()]);
      setItems(menu);
      setCategories(['All', ...cats.map((cat) => cat.name)]);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load the live menu.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load().catch(() => undefined); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().catch(() => undefined).finally(() => setRefreshing(false));
  }, [load]);

  const unavailableCount = items.filter((item) => !item.is_available).length;
  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (category === 'All' || item.category?.name === category) &&
        item.name.toLowerCase().includes(term),
    );
  }, [items, category, search]);

  const toggleAvailability = (item: StaffMenuItem) => {
    if (!token || busyId !== null) return;
    setBusyId(item.id);
    setError('');
    setFeedback('');
    staffApi
      .updateMenuAvailability(token, item.id, !item.is_available)
      .then((updated) => {
        setItems((previous) => previous.map((row) => (row.id === item.id ? updated : row)));
        setFeedback(
          updated.is_available
            ? `${item.name} is available again on the live menu.`
            : `${item.name} marked unavailable on the live menu.`,
        );
      })
      .catch((caught) => setError(errorMessage(caught, 'Could not update availability.')))
      .finally(() => setBusyId(null));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>STORE OPERATIONS</Text>
          <Text style={styles.title}>Menu Availability</Text>
          <Text style={styles.subtitle}>Changes update the live customer menu immediately.</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{items.length - unavailableCount}</Text><Text style={styles.summaryLabel}>Available</Text></View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{unavailableCount}</Text><Text style={styles.summaryLabel}>Need attention</Text></View>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search menu items"
          placeholderTextColor="#9999A1"
          style={styles.searchInput}
        />
        {search ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}><Text style={styles.clearSearch}>×</Text></Pressable> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll} contentContainerStyle={styles.categories}>
        {categories.map((item) => (
          <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, category === item && styles.categoryActive]}>
            <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}>
        {feedback ? (
          <Pressable onPress={() => setFeedback('')} style={styles.feedback} accessibilityLabel="Dismiss message">
            <Text style={styles.feedbackIcon}>✓</Text><Text style={styles.feedbackText}>{feedback}</Text><Text style={styles.feedbackClose}>×</Text>
          </Pressable>
        ) : null}
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {error}</Text>
            <Pressable onPress={onRefresh} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        )}
        <View style={styles.resultRow}><Text style={styles.resultText}>{visibleItems.length} menu items</Text><Text style={styles.demoText}>Live catalog</Text></View>
        {loading && items.length === 0 ? (
          <View style={styles.empty}><ActivityIndicator color={RED} size="large" /><Text style={styles.emptyTitle}>Loading live menu…</Text></View>
        ) : null}
        {visibleItems.map((item) => (
          <View key={item.id} style={[styles.card, !item.is_available && styles.cardMuted]}>
            <View style={styles.emojiBox}><Text style={styles.emoji}>{emojiFor(item.name)}</Text></View>
            <View style={styles.itemCopy}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>{item.category?.name ?? ''} · {peso(Number(item.base_price))}</Text>
              <View style={[styles.availabilityBadge, { backgroundColor: item.is_available ? '#DCFCE7' : '#FEE2E2' }]}>
                <View style={[styles.statusDot, { backgroundColor: item.is_available ? '#15803D' : '#B91C1C' }]} />
                <Text style={[styles.availabilityText, { color: item.is_available ? '#15803D' : '#B91C1C' }]}>
                  {item.is_available ? 'Available' : 'Unavailable'}
                </Text>
              </View>
            </View>
            <View style={styles.itemActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.is_available ? `Mark ${item.name} unavailable` : `Restore ${item.name}`}
                disabled={busyId !== null}
                onPress={() => toggleAvailability(item)}
                style={({ pressed }) => [
                  item.is_available ? styles.reportButton : styles.restoreButton,
                  pressed && styles.pressed,
                ]}>
                {busyId === item.id ? (
                  <ActivityIndicator color={item.is_available ? TEXT : '#FFFFFF'} size="small" />
                ) : (
                  <Text style={item.is_available ? styles.reportButtonText : styles.restoreButtonText}>
                    {item.is_available ? 'Mark out' : 'Restore'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        ))}
        {!loading && !visibleItems.length && <View style={styles.empty}><Text style={styles.emptyIcon}>🔎</Text><Text style={styles.emptyTitle}>No menu items found</Text><Text style={styles.emptyText}>Try another search or category.</Text></View>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerSafe: { backgroundColor: RED },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  eyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 3 },
  subtitle: { color: 'rgba(255,255,255,0.78)', fontSize: 11, lineHeight: 16, marginTop: 3 },
  summaryRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.15)' },
  summaryCard: { flex: 1, alignItems: 'center' },
  summaryNumber: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  summaryLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 10, marginTop: 1 },
  summaryDivider: { height: 28, width: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  searchWrap: { margin: 12, marginBottom: 5, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E5', backgroundColor: '#FFFFFF', paddingHorizontal: 12 },
  searchIcon: { color: GRAY, fontSize: 21 },
  searchInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 11, color: TEXT, fontSize: 14 },
  clearSearch: { color: GRAY, fontSize: 20, padding: 4 },
  categoriesScroll: { flexGrow: 0 },
  categories: { alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, gap: 7 },
  category: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E1E6' },
  categoryActive: { backgroundColor: RED, borderColor: RED },
  categoryText: { color: TEXT, fontSize: 10, fontWeight: '700' },
  categoryTextActive: { color: '#FFFFFF' },
  list: { flex: 1 },
  content: { padding: 12, paddingBottom: BottomTabInset + 24, gap: 10 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 11, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  feedbackIcon: { fontSize: 14 },
  feedbackText: { flex: 1, color: '#1E40AF', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  feedbackClose: { color: '#1D4ED8', fontSize: 19 },
  errorBox: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  retryButton: { alignSelf: 'flex-start', backgroundColor: RED, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  resultText: { color: TEXT, fontSize: 11, fontWeight: '800' },
  demoText: { color: GRAY, fontSize: 9 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11, borderRadius: 14, backgroundColor: '#FFFFFF' },
  cardMuted: { backgroundColor: '#FAFAFB' },
  emojiBox: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FDEBD2' },
  emoji: { fontSize: 29 },
  itemCopy: { flex: 1 },
  itemName: { color: TEXT, fontSize: 13, fontWeight: '800' },
  itemMeta: { color: GRAY, fontSize: 10, marginTop: 2 },
  availabilityBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 999, marginTop: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  availabilityText: { fontSize: 9, fontWeight: '800' },
  itemActions: { gap: 6, alignItems: 'stretch' },
  reportButton: { borderWidth: 1, borderColor: '#D8D8DE', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 10, minWidth: 84, alignItems: 'center' },
  reportButtonText: { color: TEXT, fontSize: 10, fontWeight: '800' },
  restoreButton: { backgroundColor: '#16A34A', borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9, minWidth: 84, alignItems: 'center' },
  restoreButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { color: TEXT, fontSize: 17, fontWeight: '900', marginTop: 8 },
  emptyText: { color: GRAY, fontSize: 11, marginTop: 3 },
});
