import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useDeliveryDemo, type RiderStatus } from '@/context/delivery-demo-context';

const RED = '#DC2626';
const BG = '#F4F4F6';
const TEXT = '#1C1C1E';
const GRAY = '#74747C';

const STATUS_META: Record<RiderStatus, { label: string; dot: string; chipBg: string; chipText: string }> = {
  available: { label: 'On Duty', dot: '#16A34A', chipBg: '#DCFCE7', chipText: '#15803D' },
  on_delivery: { label: 'On Delivery', dot: '#F59E0B', chipBg: '#FEF3C7', chipText: '#B45309' },
  offline: { label: 'Unavailable', dot: '#9CA3AF', chipBg: '#F3F4F6', chipText: '#6B7280' },
};

export default function StaffRidersScreen() {
  const { riders, deliveries } = useDeliveryDemo();
  const readyCount = deliveries.filter((delivery) => delivery.status === 'ready').length;
  const activeCount = deliveries.filter((delivery) => delivery.status === 'assigned' || delivery.status === 'picked_up').length;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>SM LANANG PREMIER · JAL-01</Text>
          <Text style={styles.title}>Riders</Text>
          <Text style={styles.subtitle}>Availability of the delivery team.</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{readyCount}</Text>
            <Text style={styles.summaryLabel}>Awaiting rider</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{activeCount}</Text>
            <Text style={styles.summaryLabel}>Out for delivery</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Delivery team</Text>
        {riders.map((rider) => {
          const meta = STATUS_META[rider.status];
          return (
            <View key={rider.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}><Text style={styles.avatarText}>🛵</Text></View>
                <View style={styles.copy}>
                  <Text style={styles.riderName}>{rider.name}</Text>
                  <Text style={styles.riderMeta}>{rider.vehicle}</Text>
                  <Text style={styles.riderMeta}>{rider.phone} · {rider.completedToday} delivered today</Text>
                </View>
                <View style={[styles.statusChip, { backgroundColor: meta.chipBg }]}>
                  <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
                  <Text style={[styles.statusText, { color: meta.chipText }]}>{meta.label}</Text>
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
  summaryLabel: { color: GRAY, fontSize: 10, marginTop: 1 },
  sectionTitle: { color: TEXT, fontSize: 15, fontWeight: '900', marginTop: 20, marginBottom: 11, paddingHorizontal: 2 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 13, padding: 13, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 19 },
  copy: { flex: 1 },
  riderName: { color: TEXT, fontSize: 14, fontWeight: '900' },
  riderMeta: { color: GRAY, fontSize: 10, marginTop: 2 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 9, fontWeight: '800' },
});