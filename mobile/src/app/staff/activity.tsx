import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { errorMessage } from '@/lib/api';
import {
  staffApi,
  type OrderStatus,
  type PaginationMeta,
  type StaffActivity,
} from '@/lib/staff-api';

const RED = '#DC2626';
const BG = '#F4F4F6';
const TEXT = '#1C1C1E';
const GRAY = '#74747C';

const STATUS_APPEARANCE: Record<OrderStatus, { icon: string; bg: string; color: string }> = {
  pending: { icon: '…', bg: '#FEF3C7', color: '#B45309' },
  confirmed: { icon: '✓', bg: '#DCFCE7', color: '#15803D' },
  preparing: { icon: '↻', bg: '#DBEAFE', color: '#1D4ED8' },
  ready: { icon: '✓', bg: '#EDE9FE', color: '#6D28D9' },
  out_for_delivery: { icon: '→', bg: '#FFEDD5', color: '#C2410C' },
  completed: { icon: '✓', bg: '#DCFCE7', color: '#15803D' },
  cancelled: { icon: '×', bg: '#FEE2E2', color: '#B91C1C' },
};

function statusLabel(status: OrderStatus): string {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function activityTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function StaffActivityScreen() {
  const { token } = useAuth();
  const [activities, setActivities] = useState<StaffActivity[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadPage = useCallback(async (page: number, replace: boolean) => {
    if (!token) return;
    setError('');
    try {
      const response = await staffApi.activity(token, page);
      setActivities((current) => replace ? response.data : [...current, ...response.data]);
      setMeta(response.meta);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load your activity history.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    void loadPage(1, true).catch(() => undefined);
  }, [loadPage]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPage(1, true).catch(() => undefined).finally(() => setRefreshing(false));
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (!meta || meta.current_page >= meta.last_page || loadingMore) return;
    setLoadingMore(true);
    loadPage(meta.current_page + 1, false)
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }, [loadPage, loadingMore, meta]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>STAFF WORKSPACE</Text>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.subtitle}>Your recorded order status changes.</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{meta?.total ?? activities.length}</Text>
            <Text style={styles.summaryLabel}>Recorded changes</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{activities.length}</Text>
            <Text style={styles.summaryLabel}>Currently shown</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <Text style={styles.sectionMeta}>Newest first</Text>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={onRefresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {loading && activities.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator color={RED} size="large" />
            <Text style={styles.emptyTitle}>Loading activity…</Text>
          </View>
        ) : null}

        {!loading && !error && activities.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>○</Text>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyText}>Order status changes you make will appear here.</Text>
          </View>
        ) : null}

        <View style={styles.timeline}>
          {activities.map((activity, index) => {
            const appearance = STATUS_APPEARANCE[activity.status];
            return (
              <View key={activity.id} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.activityIcon, { backgroundColor: appearance.bg }]}>
                    <Text style={[styles.activityIconText, { color: appearance.color }]}>{appearance.icon}</Text>
                  </View>
                  {index < activities.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.activityCard}>
                  <View style={styles.activityTop}>
                    <Text style={styles.activityTitle}>{activity.order.order_number}</Text>
                    <Text style={styles.activityTime}>{activityTime(activity.created_at)}</Text>
                  </View>
                  <Text style={[styles.statusText, { color: appearance.color }]}>
                    {statusLabel(activity.status)}
                  </Text>
                  <Text style={styles.activityDetail}>
                    {activity.note || `Status updated by ${activity.actor?.name ?? 'staff'}.`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {meta && meta.current_page < meta.last_page ? (
          <Pressable disabled={loadingMore} onPress={loadMore} style={styles.loadMoreButton}>
            {loadingMore ? (
              <ActivityIndicator color={RED} />
            ) : (
              <Text style={styles.loadMoreText}>Load older activity</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerSafe: { backgroundColor: RED },
  header: { paddingHorizontal: 16, paddingBottom: 17 },
  eyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 3 },
  subtitle: { color: 'rgba(255,255,255,0.76)', fontSize: 11, marginTop: 4 },
  content: { padding: 14, paddingBottom: BottomTabInset + 24 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 13, padding: 12 },
  summaryNumber: { color: TEXT, fontSize: 22, fontWeight: '900' },
  summaryLabel: { color: GRAY, fontSize: 10, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 11, paddingHorizontal: 2 },
  sectionTitle: { color: TEXT, fontSize: 15, fontWeight: '900' },
  sectionMeta: { color: GRAY, fontSize: 9 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineRail: { width: 34, alignItems: 'center' },
  activityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  activityIconText: { fontSize: 14, fontWeight: '900' },
  timelineLine: { flex: 1, width: 2, minHeight: 18, backgroundColor: '#D9D9DE' },
  activityCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 13, padding: 12, marginBottom: 11 },
  activityTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  activityTitle: { flex: 1, color: TEXT, fontSize: 12, fontWeight: '800', lineHeight: 16 },
  activityTime: { color: GRAY, fontSize: 9 },
  statusText: { fontSize: 10, fontWeight: '900', marginTop: 5 },
  activityDetail: { color: GRAY, fontSize: 10, lineHeight: 15, marginTop: 3 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 13, marginBottom: 12, padding: 12 },
  errorText: { color: '#991B1B', fontSize: 11, lineHeight: 16 },
  retryButton: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 6 },
  retryText: { color: RED, fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 13, padding: 24 },
  emptyIcon: { color: '#A1A1AA', fontSize: 28 },
  emptyTitle: { color: TEXT, fontSize: 13, fontWeight: '800', marginTop: 8 },
  emptyText: { color: GRAY, fontSize: 10, textAlign: 'center', marginTop: 4 },
  loadMoreButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 11, padding: 12, marginTop: 4 },
  loadMoreText: { color: RED, fontSize: 11, fontWeight: '800' },
});
