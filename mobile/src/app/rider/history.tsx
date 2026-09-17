import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useDeliveryDemo } from '@/context/delivery-demo-context';

const RED = '#DC2626';
const BG = '#F4F4F6';
const TEXT = '#1C1C1E';
const GRAY = '#74747C';

function peso(value: number): string {
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export default function RiderHistoryScreen() {
  const { riders, deliveries } = useDeliveryDemo();
  const rider = riders[0];
  const completed = deliveries
    .filter((delivery) => delivery.riderId === rider.id && delivery.status === 'delivered')
    .sort((a, b) => (b.deliveredAt ?? '').localeCompare(a.deliveredAt ?? ''));
  const codCollected = completed.reduce((sum, delivery) => sum + delivery.codAmount, 0);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>DELIVERY RIDER</Text>
          <Text style={styles.title}>Delivery History</Text>
          <Text style={styles.subtitle}>{rider.name} · {rider.vehicle}</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{completed.length}</Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{peso(codCollected)}</Text>
            <Text style={styles.summaryLabel}>COD collected</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{rider.completedToday}</Text>
            <Text style={styles.summaryLabel}>Today</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Delivered orders</Text>
        {completed.length ? (
          completed.map((delivery) => (
            <View key={delivery.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.orderNumber}>{delivery.orderNumber}</Text>
                <Text style={styles.deliveredAt}>{delivery.deliveredAt}</Text>
              </View>
              <Text style={styles.customer}>{delivery.customer} · {delivery.destination.destinationName}</Text>
              <Text style={styles.address}>{delivery.address}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.codAmount}>COD {peso(delivery.codAmount)}</Text>
                <Text style={styles.distance}>{delivery.distanceKm} km</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>No deliveries yet</Text>
            <Text style={styles.emptyText}>Completed deliveries will appear here.</Text>
          </View>
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
  codAmount: { color: '#B45309', fontSize: 11, fontWeight: '900' },
  distance: { color: GRAY, fontSize: 10 },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: TEXT, fontSize: 18, fontWeight: '900', marginTop: 10 },
  emptyText: { color: GRAY, fontSize: 12, marginTop: 4 },
});