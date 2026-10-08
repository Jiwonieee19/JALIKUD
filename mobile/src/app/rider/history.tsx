import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { errorMessage } from '@/lib/api';
import { riderApi } from '@/lib/staff-api';

const RED = '#DC2626';
const BG = '#F4F4F6';
const TEXT = '#1C1C1E';
const GRAY = '#74747C';

function peso(value: number): string {
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export default function RiderHistoryScreen() {
  const { token, user } = useAuth();
  const [completed, setCompleted] = useState<
    { id: number; orderNumber: string; date: string; customer: string; address: string; amount: number; paymentMethod: 'cod' | 'gcash'; paymentStatus: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const queue = await riderApi.deliveries(token);
      setCompleted(
        queue
          .filter((order) => order.status === 'completed')
          .map((order) => ({
            id: order.id,
            orderNumber: order.order_number,
            date: new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(order.placed_at),
            ),
            customer: order.user?.name ?? 'Customer',
            address: order.address
              ? [order.address.line1, order.address.line2, order.address.city].filter(Boolean).join(', ')
              : 'Customer address on file',
            amount: Number(order.total_amount),
            paymentMethod: order.payment_method === 'gcash' ? 'gcash' : 'cod',
            paymentStatus: order.payment_status,
          })),
      );
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load delivery history.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void load().catch(() => undefined); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().catch(() => undefined).finally(() => setRefreshing(false));
  }, [load]);

  const codCollected = completed.reduce(
    (sum, delivery) => sum + (delivery.paymentMethod === 'cod' && delivery.paymentStatus === 'paid' ? delivery.amount : 0),
    0,
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DELIVERY RIDER</Text>
          <Text style={styles.title}>Delivery History</Text>
          <Text style={styles.subtitle}>{user?.name ?? 'Rider'}</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{completed.length}</Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{peso(codCollected)}</Text>
            <Text style={styles.summaryLabel}>COD collected</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Delivered orders</Text>
        {loading && completed.length === 0 ? (
          <View style={styles.empty}><ActivityIndicator color={RED} size="large" /><Text style={styles.emptyTitle}>Loading history…</Text></View>
        ) : null}
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {error}</Text>
            <Pressable onPress={onRefresh} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        )}
        {completed.length ? (
          completed.map((delivery) => (
            <View key={delivery.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.orderNumber}>{delivery.orderNumber}</Text>
                <Text style={styles.deliveredAt}>{delivery.date}</Text>
              </View>
              <Text style={styles.customer}>{delivery.customer}</Text>
              <Text style={styles.address}>{delivery.address}</Text>
              <View style={styles.cardFooter}>
                <Text style={[styles.paymentAmount, delivery.paymentMethod === 'gcash' && styles.gcashPayment]}>
                  {delivery.paymentMethod === 'cod'
                    ? `COD ${delivery.paymentStatus === 'paid' ? 'collected' : 'unpaid'} ${peso(delivery.amount)}`
                    : `GCash ${delivery.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}`}
                </Text>
              </View>
            </View>
          ))
        ) : (
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No deliveries yet</Text>
              <Text style={styles.emptyText}>Completed deliveries will appear here.</Text>
            </View>
          )
        )}
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
  subtitle: { color: 'rgba(255,255,255,0.78)', fontSize: 11, marginTop: 4 },
  content: { padding: 14, paddingBottom: BottomTabInset + 24 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 13, padding: 12 },
  summaryNumber: { color: TEXT, fontSize: 19, fontWeight: '900' },
  summaryLabel: { color: GRAY, fontSize: 9, marginTop: 2 },
  sectionTitle: { color: TEXT, fontSize: 15, fontWeight: '900', marginTop: 20, marginBottom: 11, paddingHorizontal: 2 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 13, padding: 13, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { color: TEXT, fontSize: 14, fontWeight: '900' },
  deliveredAt: { color: GRAY, fontSize: 10 },
  customer: { color: TEXT, fontSize: 12, fontWeight: '700', marginTop: 5 },
  address: { color: GRAY, fontSize: 10, lineHeight: 14, marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  paymentAmount: { color: '#B45309', fontSize: 11, fontWeight: '900' },
  gcashPayment: { color: '#1D4ED8' },
  errorBox: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', marginBottom: 10 },
  errorText: { color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  retryButton: { alignSelf: 'flex-start', backgroundColor: RED, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: TEXT, fontSize: 18, fontWeight: '900', marginTop: 10 },
  emptyText: { color: GRAY, fontSize: 12, marginTop: 4 },
});
