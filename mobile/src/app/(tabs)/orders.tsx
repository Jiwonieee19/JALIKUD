import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useCustomerOrder, type CustomerOrderStatus } from '@/context/customer-order-context';

const RED = '#DC2626';
const BG = '#F4F4F6';
const CARD = '#FFFFFF';
const TEXT_DARK = '#1C1C1E';
const TEXT_GRAY = '#8E8E93';

type OrderTab = 'active' | 'completed' | 'canceled';
const ORDER_TABS: { value: OrderTab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
];
const ACTIVE_STATUSES = new Set<string>(['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery']);

const STATUS_LABELS: Record<CustomerOrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'On the Way',
  completed: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<CustomerOrderStatus, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#B45309' },
  confirmed: { bg: '#DBEAFE', text: '#1D4ED8' },
  preparing: { bg: '#FFEDD5', text: '#C2410C' },
  ready: { bg: '#F3E8FF', text: '#7E22CE' },
  out_for_delivery: { bg: '#E0E7FF', text: '#4338CA' },
  completed: { bg: '#DCFCE7', text: '#15803D' },
  cancelled: { bg: '#F0F0F3', text: TEXT_GRAY },
};

function peso(value: number): string {
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function tabForStatus(status: string): OrderTab {
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'canceled';
  return 'active';
}

function readableStatus(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// UI only — order actions (details, cancel, reorder) are not implemented yet.
export default function OrdersScreen() {
  const { orders, refreshOrders, error } = useCustomerOrder();
  const [tab, setTab] = useState<OrderTab>('active');
  const [refreshing, setRefreshing] = useState(false);
  useFocusEffect(useCallback(() => { void refreshOrders().catch(() => undefined); }, [refreshOrders]));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshOrders().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [refreshOrders]);

  const counts: Record<OrderTab, number> = { active: 0, completed: 0, canceled: 0 };
  for (const order of orders) counts[tabForStatus(order.status)] += 1;
  const shown = orders.filter((order) => tabForStatus(order.status) === tab);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshOrders().catch(() => undefined).finally(() => setRefreshing(false));
  }, [refreshOrders]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Red header: title + segmented tabs */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleIconBox}>
              <Text style={styles.titleIcon}>📦</Text>
            </View>
            <Text style={styles.title}>My Orders</Text>
          </View>

          <View style={styles.segmentedRow}>
            {ORDER_TABS.map((segment) => (
              <Pressable
                key={segment.value}
                onPress={() => setTab(segment.value)}
                style={[styles.segment, tab === segment.value && styles.segmentActive]}>
                <Text style={[styles.segmentText, tab === segment.value && styles.segmentTextActive]}>
                  {segment.label} ({counts[segment.value]})
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} colors={[RED]} />}
        showsVerticalScrollIndicator={false}>
        {shown.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No {tab} orders</Text>
            <Text style={styles.emptyMessage}>{error || `Your ${tab} orders will appear here`}</Text>
          </View>
        ) : (
          shown.map((order) => {
            const runtimeStatus = order.status as string;
            const statusColors = STATUS_COLORS[order.status] ?? { bg: '#E5E7EB', text: '#374151' };
            const statusLabel = STATUS_LABELS[order.status] ?? readableStatus(runtimeStatus);
            return (
              <View key={order.id} style={styles.card}>
                {/* Order header row */}
                <View style={styles.orderTopRow}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                    <Text style={styles.orderDate}>{order.date}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                    <Text style={[styles.statusText, { color: statusColors.text }]}>{statusLabel}</Text>
                  </View>
                </View>

                <Text style={styles.orderItems}>{order.items}</Text>

                {/* Progress tracker for active orders */}
                {ACTIVE_STATUSES.has(runtimeStatus) && (
                  <View style={styles.progressWrap}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                           {
                             width:
                                order.status === 'pending'
                                 ? '10%'
                                  : order.status === 'confirmed'
                                    ? '22%'
                                    : order.status === 'preparing'
                                   ? '33%'
                                    : order.status === 'ready' ? '52%' : '66%',
                           },
                        ]}
                      />
                    </View>
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressLabelDone}>Placed</Text>
                      <Text
                        style={
                          order.status === 'preparing'
                            ? styles.progressLabelDone
                            : styles.progressLabel
                        }>
                        Preparing
                      </Text>
                      <Text
                        style={
                          order.status === 'out_for_delivery'
                            ? styles.progressLabelDone
                            : styles.progressLabel
                        }>
                        On the Way
                      </Text>
                      <Text style={styles.progressLabel}>Delivered</Text>
                    </View>
                    <Text style={styles.etaText}>· ~30 min</Text>
                  </View>
                )}

                {/* Pickup code */}
                {order.pickupCode != null && (
                  <View style={styles.pickupBox}>
                    <Text style={styles.pickupLabel}>Pickup Code</Text>
                    <Text style={styles.pickupCode}>{order.pickupCode}</Text>
                  </View>
                )}

                {/* Cancel reason */}
                {order.cancelReason != null && (
                  <Text style={styles.cancelReason}>ⓘ {order.cancelReason}</Text>
                )}

                {/* Footer: total + actions */}
                <View style={styles.orderFooter}>
                  <Text style={styles.orderTotal}>{peso(order.total)}</Text>
                  <Text style={styles.orderDate}>{order.deliveryType === 'delivery' ? 'Delivery' : 'Pickup'}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerSafe: { backgroundColor: RED },
  header: {
    backgroundColor: RED,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleIcon: { fontSize: 18 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 11,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#FFFFFF' },
  segmentText: { fontSize: 12, fontWeight: '700', color: 'rgba(255, 255, 255, 0.85)' },
  segmentTextActive: { color: RED },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: BottomTabInset + 24,
    gap: 12,
  },
  pressed: { opacity: 0.8 },
  emptyBox: { alignItems: 'center', paddingTop: 64, gap: 6 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TEXT_DARK },
  emptyMessage: { fontSize: 13, color: TEXT_GRAY },
  card: { backgroundColor: CARD, borderRadius: 14, padding: 14 },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  orderInfo: { gap: 2 },
  orderNumber: { fontSize: 14, fontWeight: '800', color: TEXT_DARK },
  orderDate: { fontSize: 12, color: TEXT_GRAY },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '800' },
  orderItems: { fontSize: 12, color: TEXT_GRAY, marginBottom: 4 },
  progressWrap: { marginTop: 8, marginBottom: 4 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E4E4E9',
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: RED },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginHorizontal: -6,
  },
  progressLabel: { fontSize: 9, fontWeight: '600', color: '#C7C7CC' },
  progressLabelDone: { fontSize: 9, fontWeight: '700', color: RED },
  etaText: { fontSize: 11, color: TEXT_GRAY, textAlign: 'center', marginTop: 2 },
  pickupBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF9C3',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 8,
  },
  pickupLabel: { fontSize: 12, color: TEXT_GRAY },
  pickupCode: { fontSize: 20, fontWeight: '800', color: '#CA8A04' },
  cancelReason: { fontSize: 12, color: TEXT_GRAY, marginTop: 8 },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F3',
    marginTop: 10,
    paddingTop: 10,
  },
  orderTotal: { fontSize: 15, fontWeight: '800', color: RED },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E9',
  },
  actionText: { fontSize: 12, fontWeight: '700', color: TEXT_GRAY },
  actionButtonPrimary: { backgroundColor: RED, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 10 },
  actionTextPrimary: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
});



