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

type OrderStatus = 'preparing' | 'out_for_delivery' | 'completed' | 'canceled';
type OrderTab = 'active' | 'completed' | 'canceled';

type Order = {
  id: string;
  orderNumber: string;
  date: string;
  status: OrderStatus;
  items: string;
  total: number;
  deliveryType: 'delivery' | 'pickup';
  pickupCode?: string;
  cancelReason?: string;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  preparing: 'Preparing',
  out_for_delivery: 'On the Way',
  completed: 'Delivered',
  canceled: 'Canceled',
};

const STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  preparing: { bg: '#FFEDD5', text: '#C2410C' },
  out_for_delivery: { bg: '#E0E7FF', text: '#4338CA' },
  completed: { bg: '#DCFCE7', text: '#15803D' },
  canceled: { bg: '#F0F0F3', text: TEXT_GRAY },
};

// Static orders for now — will be replaced by the backend API later.
const ORDERS: Order[] = [
  {
    id: '1',
    orderNumber: 'JAL-230001',
    date: 'Aug 29, 12:47 PM',
    status: 'preparing',
    items: 'Chickenjoy 1pc ×2',
    total: 327,
    deliveryType: 'delivery',
  },
  {
    id: '2',
    orderNumber: 'JAL-229987',
    date: 'Aug 27, 6:12 PM',
    status: 'out_for_delivery',
    items: 'Yumburger ×1 · Champ Burger ×2',
    total: 487,
    deliveryType: 'delivery',
  },
  {
    id: '3',
    orderNumber: 'JAL-229902',
    date: 'Aug 25, 11:03 AM',
    status: 'completed',
    items: 'Jolly Spaghetti ×2 · Regular Fries ×1',
    total: 269,
    deliveryType: 'pickup',
    pickupCode: 'A42',
  },
  {
    id: '4',
    orderNumber: 'JAL-229764',
    date: 'Aug 22, 7:21 PM',
    status: 'canceled',
    items: 'Palabok Fiesta ×1',
    total: 115,
    deliveryType: 'delivery',
    cancelReason: 'User requested cancellation',
  },
];

function peso(value: number): string {
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

// UI only — order actions (details, cancel, reorder) are not implemented yet.
export default function OrdersScreen() {
  const [tab, setTab] = useState<OrderTab>('active');

  const active = ORDERS.filter(
    (order) => order.status === 'preparing' || order.status === 'out_for_delivery',
  );
  const completed = ORDERS.filter((order) => order.status === 'completed');
  const canceled = ORDERS.filter((order) => order.status === 'canceled');
  const shown = tab === 'active' ? active : tab === 'completed' ? completed : canceled;

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
            {(['active', 'completed', 'canceled'] as const).map((segment) => (
              <Pressable
                key={segment}
                onPress={() => setTab(segment)}
                style={[styles.segment, tab === segment && styles.segmentActive]}>
                <Text style={[styles.segmentText, tab === segment && styles.segmentTextActive]}>
                  {segment.charAt(0).toUpperCase() + segment.slice(1)}
                  {segment === 'active' && active.length > 0 ? ` (${active.length})` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {shown.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No {tab} orders</Text>
            <Text style={styles.emptyMessage}>Your {tab} orders will appear here</Text>
          </View>
        ) : (
          shown.map((order) => {
            const statusColors = STATUS_COLORS[order.status];
            return (
              <View key={order.id} style={styles.card}>
                {/* Order header row */}
                <View style={styles.orderTopRow}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                    <Text style={styles.orderDate}>{order.date}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                    <Text style={[styles.statusText, { color: statusColors.text }]}>
                      {STATUS_LABELS[order.status]}
                    </Text>
                  </View>
                </View>

                <Text style={styles.orderItems}>{order.items}</Text>

                {/* Progress tracker for active orders */}
                {(order.status === 'preparing' || order.status === 'out_for_delivery') && (
                  <View style={styles.progressWrap}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: order.status === 'preparing' ? '33%' : '66%' },
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
                  <View style={styles.actionRow}>
                    <Pressable
                      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                      <Text style={styles.actionText}>Details</Text>
                    </Pressable>
                    {(order.status === 'completed' || order.status === 'canceled') && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionButtonPrimary,
                          pressed && styles.pressed,
                        ]}>
                        <Text style={styles.actionTextPrimary}>↺ Reorder</Text>
                      </Pressable>
                    )}
                  </View>
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



