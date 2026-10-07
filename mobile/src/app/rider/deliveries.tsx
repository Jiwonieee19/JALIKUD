import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import DeliverySchematicMap from '@/components/delivery-schematic-map';

import { BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { errorMessage } from '@/lib/api';
import { riderApi, type StaffOrder } from '@/lib/staff-api';

const RED = '#DC2626';
const BG = '#F4F4F6';
const TEXT = '#1C1C1E';
const GRAY = '#74747C';
const GREEN = '#16A34A';

const STORE_LOCATION = { latitude: 7.1904, longitude: 125.4539 };
const FALLBACK_DESTINATION = { latitude: 7.0832, longitude: 125.5907 };

type LatLng = { latitude: number; longitude: number };
type DeliveryPhase = 'assigned' | 'picked_up' | 'delivered';

type LiveDelivery = {
  id: number;
  orderNumber: string;
  customer: string;
  phone: string;
  address: string;
  destinationName: string;
  items: { name: string; quantity: number }[];
  codAmount: number;
  store: LatLng;
  destination: LatLng;
  phase: DeliveryPhase;
  assignedAt: string;
  placedAt: string;
};

/** Interpolated waypoints (with a gentle curve) for the rider's route. */
function buildRoute(from: LatLng, to: LatLng, steps = 24): LatLng[] {
  return Array.from({ length: steps + 1 }, (_, index) => ({
    latitude: from.latitude + ((to.latitude - from.latitude) * index) / steps,
    longitude:
      from.longitude +
      ((to.longitude - from.longitude) * index) / steps +
      0.004 * Math.sin((Math.PI * index) / steps),
  }));
}

function peso(value: number): string {
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function phaseOf(order: StaffOrder): DeliveryPhase | null {
  if (order.status === 'ready') return 'assigned';
  if (order.status === 'out_for_delivery') return 'picked_up';
  if (order.status === 'completed') return 'delivered';
  return null;
}

function toDelivery(order: StaffOrder): LiveDelivery | null {
  const phase = phaseOf(order);
  if (!phase) return null;
  const address = order.address;
  const addressText = address
    ? [address.line1, address.line2, address.city].filter(Boolean).join(', ')
    : 'Customer address on file';
  const lat = Number(address?.latitude);
  const lng = Number(address?.longitude);
  return {
    id: order.id,
    orderNumber: order.order_number,
    customer: order.user?.name ?? 'Customer',
    phone: order.user?.phone ?? '—',
    address: addressText,
    destinationName: address?.label || "Customer's House",
    items: (order.order_items ?? []).map((line) => ({ name: line.item_name, quantity: line.quantity })),
    codAmount: Number(order.total_amount),
    store: STORE_LOCATION,
    destination: {
      latitude: Number.isFinite(lat) ? lat : FALLBACK_DESTINATION.latitude,
      longitude: Number.isFinite(lng) ? lng : FALLBACK_DESTINATION.longitude,
    },
    phase,
    assignedAt: order.assigned_at ? formatDate(order.assigned_at) : formatDate(order.placed_at),
    placedAt: order.placed_at,
  };
}

function Stepper({ phase }: { phase: DeliveryPhase }) {
  const steps = [
    { key: 'assigned', label: 'Assigned' },
    { key: 'picked_up', label: 'Picked up' },
    { key: 'delivered', label: 'Delivered' },
  ];
  const activeIndex = phase === 'assigned' ? 0 : phase === 'picked_up' ? 1 : 2;
  return (
    <View style={styles.stepper}>
      {steps.map((step, index) => (
        <View key={step.key} style={styles.stepperStep}>
          <View style={styles.stepperDotRow}>
            <View style={[styles.stepperDot, index <= activeIndex && styles.stepperDotDone]} />
            {index < steps.length - 1 && (
              <View style={[styles.stepperLine, index < activeIndex && styles.stepperLineDone]} />
            )}
          </View>
          <Text style={[styles.stepperLabel, index <= activeIndex && styles.stepperLabelDone]}>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Full-screen map modal: JALIKUD store → customer's house, with simulated rider movement. */
function DeliveryMapModal({
  delivery,
  busy,
  onPickUp,
  onComplete,
  onClose,
}: {
  delivery: LiveDelivery;
  busy: boolean;
  onPickUp: () => void;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [route] = useState<LatLng[]>(() => buildRoute(delivery.store, delivery.destination));
  const [progress, setProgress] = useState(delivery.phase === 'picked_up' ? 0.35 : 0.1);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!moving) return;
    const interval = setInterval(() => {
      setProgress((current) => (current >= 0.92 ? 0.92 : current + 0.04));
    }, 900);
    return () => clearInterval(interval);
  }, [moving]);

  const position = route[Math.floor(progress * (route.length - 1))];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.mapModal}>
        <DeliverySchematicMap
          route={route}
          rider={delivery.phase === 'picked_up' ? position : null}
          showRider={delivery.phase === 'picked_up'}
          progress={progress}
          customerName={delivery.customer}
        />

        <SafeAreaView edges={['top']} style={styles.mapHeaderSafe}>
          <View style={styles.mapHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close map"
              onPress={onClose}
              style={({ pressed }) => [styles.mapBackButton, pressed && styles.pressed]}>
              <Text style={styles.mapBackText}>←</Text>
            </Pressable>
            <View style={styles.mapHeaderCopy}>
              <Text style={styles.mapHeaderTitle}>{delivery.destinationName}</Text>
              <Text style={styles.mapHeaderSubtitle}>
                {delivery.orderNumber} · COD {peso(delivery.codAmount)}
              </Text>
            </View>
          </View>
        </SafeAreaView>

        <View style={styles.mapBottomCard}>
          <View style={styles.mapBottomRow}>
            <View style={styles.mapBottomCopy}>
              <Text style={styles.mapBottomLabel}>Deliver to</Text>
              <Text style={styles.mapBottomName}>{delivery.customer} · {delivery.phone}</Text>
              <Text style={styles.mapBottomAddress}>{delivery.address}</Text>
            </View>
            {delivery.phase === 'picked_up' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Simulate rider movement"
                onPress={() => setMoving((value) => !value)}
                style={({ pressed }) => [styles.simulateButton, moving && styles.simulateButtonActive, pressed && styles.pressed]}>
                <Text style={styles.simulateText}>{moving ? '⏸ Stop' : '▶ Start'}</Text>
              </Pressable>
            )}
          </View>
          {delivery.phase === 'picked_up' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Complete delivery"
              disabled={busy}
              onPress={onComplete}
              style={({ pressed }) => [styles.completeButton, pressed && styles.pressed]}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.completeButtonText}>✓ Complete delivery</Text>
              )}
            </Pressable>
          ) : delivery.phase === 'assigned' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark order picked up"
              disabled={busy}
              onPress={onPickUp}
              style={({ pressed }) => [styles.completeButton, pressed && styles.pressed]}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.completeButtonText}>Pick up order</Text>
              )}
            </Pressable>
          ) : (
            <Text style={styles.mapHint}>Pick up the order from the store first, then start delivery.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function RiderDeliveriesScreen() {
  const { token, user } = useAuth();
  const [deliveries, setDeliveries] = useState<LiveDelivery[]>([]);
  const [onDuty, setOnDuty] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [togglingDuty, setTogglingDuty] = useState(false);
  const [error, setError] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [moving, setMoving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const queue = await riderApi.deliveries(token);
      setDeliveries(queue.map(toDelivery).filter((d): d is LiveDelivery => d !== null));
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load your deliveries.'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void load().catch(() => undefined); }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().catch(() => undefined).finally(() => setRefreshing(false));
  }, [load]);

  const active = [...deliveries].reverse().find((delivery) => delivery.phase !== 'delivered') ?? null;
  const history = deliveries.filter((delivery) => delivery.phase === 'delivered');

  const advance = async (delivery: LiveDelivery, next: 'out_for_delivery' | 'completed') => {
    if (!token || busyId !== null) return;
    setBusyId(delivery.id);
    setError('');
    try {
      const updated = await riderApi.updateStatus(token, delivery.id, next);
      const mapped = toDelivery(updated);
      setDeliveries((previous) =>
        previous.map((row) => (row.id === delivery.id && mapped ? mapped : row)),
      );
      if (next === 'completed') setShowMap(false);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not update the delivery.'));
    } finally {
      setBusyId(null);
    }
  };

  const toggleDuty = (next: boolean) => {
    if (!token || togglingDuty || (active && next === false)) return;
    setTogglingDuty(true);
    riderApi
      .setAvailability(token, next)
      .then((profile) => setOnDuty(profile.is_active))
      .catch((caught) => setError(errorMessage(caught, 'Could not update duty status.')))
      .finally(() => setTogglingDuty(false));
  };

  const startMoving = () => setMoving(true);
  const onDelivery = active?.phase === 'picked_up';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>DELIVERY RIDER</Text>
              <Text style={styles.title}>My Deliveries</Text>
              <Text style={styles.subtitle}>{user?.name ?? 'Rider'}</Text>
            </View>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{history.length}</Text>
              <Text style={styles.headerBadgeLabel}>done</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}>
        <View style={styles.availabilityCard}>
          <View style={styles.availabilityHeader}>
            <View>
              <Text style={styles.availabilityEyebrow}>AVAILABILITY</Text>
              <Text style={styles.availabilityTitle}>Choose your duty status</Text>
            </View>
            <View
              style={[
                styles.currentStatus,
                onDuty && styles.currentStatusOnDuty,
                onDelivery && styles.currentStatusOnDelivery,
              ]}>
              <Text style={styles.currentStatusText}>
                {onDelivery ? 'On Delivery' : onDuty ? 'On Duty' : 'Unavailable'}
              </Text>
            </View>
          </View>
          <Text style={styles.availabilityHint}>
            {onDelivery
              ? 'Finish your active delivery before changing availability.'
              : 'Only On Duty riders receive delivery assignments from staff.'}
          </Text>
          <View style={styles.availabilityActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set rider status to On Duty"
              disabled={!!onDelivery || togglingDuty}
              onPress={() => toggleDuty(true)}
              style={({ pressed }) => [
                styles.availabilityButton,
                onDuty && styles.onDutyButton,
                !!onDelivery && styles.availabilityButtonDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.availabilityButtonText, onDuty && styles.availabilityButtonTextActive]}>
                On Duty
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Set rider status to Unavailable"
              disabled={!!onDelivery || togglingDuty}
              onPress={() => toggleDuty(false)}
              style={({ pressed }) => [
                styles.availabilityButton,
                !onDuty && styles.unavailableButton,
                !!onDelivery && styles.availabilityButtonDisabled,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.availabilityButtonText, !onDuty && styles.availabilityButtonTextActive]}>
                Unavailable
              </Text>
            </Pressable>
          </View>
        </View>

        {loading && deliveries.length === 0 ? (
          <View style={styles.card}>
            <ActivityIndicator color={RED} size="large" />
            <Text style={styles.emptyText}>Loading your deliveries…</Text>
          </View>
        ) : null}
        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {error}</Text>
            <Pressable onPress={onRefresh} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        )}

        {active ? (
          <View style={styles.card}>
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.orderNumber}>{active.orderNumber}</Text>
                <Text style={styles.orderMeta}>Assigned {active.assignedAt}</Text>
              </View>
              <View style={styles.codBadge}>
                <Text style={styles.codText}>COD {peso(active.codAmount)}</Text>
              </View>
            </View>

            <Stepper phase={active.phase} />

            <View style={styles.addressBox}>
              <Text style={styles.addressLabel}>Deliver to</Text>
              <Text style={styles.addressName}>{active.customer} · {active.phone}</Text>
              <Text style={styles.addressText}>{active.address}</Text>
            </View>

            <View style={styles.itemsBox}>
              {active.items.map((item) => (
                <View key={item.name} style={styles.itemRow}>
                  <Text style={styles.itemQuantity}>{item.quantity}×</Text>
                  <Text style={styles.itemName}>{item.name}</Text>
                </View>
              ))}
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open delivery map"
                onPress={() => setShowMap(true)}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>🗺️ View map</Text>
              </Pressable>
              {active.phase === 'assigned' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark order picked up"
                  disabled={busyId === active.id}
                  onPress={() => {
                    void advance(active, 'out_for_delivery').then(() => startMoving());
                  }}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  {busyId === active.id ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Pick up order</Text>
                  )}
                </Pressable>
              ) : (
                <Text style={styles.movingHint}>{moving ? '🛵 On the way…' : 'Deliver via the map'}</Text>
              )}
            </View>
          </View>
        ) : (
          !loading && (
            <View style={styles.card}>
              <Text style={styles.emptyIcon}>☕</Text>
              <Text style={styles.emptyTitle}>All clear</Text>
              <Text style={styles.emptyText}>No deliveries assigned. Enjoy the break!</Text>
            </View>
          )
        )}

        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Completed ({history.length})</Text>
            {history.map((delivery) => (
              <View key={delivery.id} style={styles.historyRow}>
                <Text style={styles.historyIcon}>✓</Text>
                <View style={styles.historyCopy}>
                  <Text style={styles.historyOrder}>{delivery.orderNumber} · {delivery.customer}</Text>
                  <Text style={styles.historyMeta}>COD collected {peso(delivery.codAmount)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {showMap && active && (
        <DeliveryMapModal
          delivery={active}
          busy={busyId === active.id}
          onPickUp={() => void advance(active, 'out_for_delivery')}
          onComplete={() => void advance(active, 'completed')}
          onClose={() => setShowMap(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerSafe: { backgroundColor: RED },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerCopy: { flex: 1, paddingRight: 10 },
  eyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 3 },
  subtitle: { color: 'rgba(255,255,255,0.78)', fontSize: 11, marginTop: 4 },
  headerBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.17)' },
  headerBadgeText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  headerBadgeLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 9, fontWeight: '700' },
  content: { padding: 14, paddingBottom: BottomTabInset + 24 },
  availabilityCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12 },
  availabilityHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  availabilityEyebrow: { color: GRAY, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  availabilityTitle: { color: TEXT, fontSize: 15, fontWeight: '900', marginTop: 3 },
  currentStatus: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F3F4F6' },
  currentStatusOnDuty: { backgroundColor: '#DCFCE7' },
  currentStatusOnDelivery: { backgroundColor: '#FEF3C7' },
  currentStatusText: { color: TEXT, fontSize: 9, fontWeight: '800' },
  availabilityHint: { color: GRAY, fontSize: 11, lineHeight: 16, marginTop: 8 },
  availabilityActions: { flexDirection: 'row', gap: 9, marginTop: 12 },
  availabilityButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 11, borderWidth: 1, borderColor: '#D8D8DE', backgroundColor: '#F8F8FA' },
  onDutyButton: { borderColor: GREEN, backgroundColor: GREEN },
  unavailableButton: { borderColor: '#6B7280', backgroundColor: '#6B7280' },
  availabilityButtonDisabled: { opacity: 0.45 },
  availabilityButtonText: { color: TEXT, fontSize: 12, fontWeight: '800' },
  availabilityButtonTextActive: { color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15 },
  orderHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  orderNumber: { color: TEXT, fontSize: 17, fontWeight: '900' },
  orderMeta: { color: GRAY, fontSize: 10, marginTop: 3 },
  codBadge: { backgroundColor: '#FEF3C7', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  codText: { color: '#B45309', fontSize: 11, fontWeight: '900' },
  stepper: { flexDirection: 'row', marginTop: 15, marginBottom: 4 },
  stepperStep: { flex: 1 },
  stepperDotRow: { flexDirection: 'row', alignItems: 'center' },
  stepperDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#E4E4E9', borderWidth: 2, borderColor: '#E4E4E9' },
  stepperDotDone: { backgroundColor: GREEN, borderColor: GREEN },
  stepperLine: { flex: 1, height: 2, backgroundColor: '#E4E4E9', marginHorizontal: 3 },
  stepperLineDone: { backgroundColor: GREEN },
  stepperLabel: { color: GRAY, fontSize: 9, fontWeight: '700', marginTop: 6 },
  stepperLabelDone: { color: GREEN },
  addressBox: { marginTop: 14, padding: 11, borderRadius: 11, backgroundColor: '#F8F8FA' },
  addressLabel: { color: GRAY, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  addressName: { color: TEXT, fontSize: 13, fontWeight: '800', marginTop: 4 },
  addressText: { color: GRAY, fontSize: 11, lineHeight: 16, marginTop: 2 },
  itemsBox: { marginTop: 11, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEEEF1', gap: 8 },
  itemRow: { flexDirection: 'row', gap: 9 },
  itemQuantity: { width: 24, color: RED, fontSize: 13, fontWeight: '900' },
  itemName: { color: TEXT, fontSize: 13, fontWeight: '700', flex: 1 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13 },
  secondaryButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 11, borderWidth: 1, borderColor: '#F0A5A5' },
  secondaryButtonText: { color: RED, fontSize: 12, fontWeight: '800' },
  primaryButton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 11, backgroundColor: RED },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  movingHint: { flex: 1, color: GRAY, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  emptyIcon: { fontSize: 42, textAlign: 'center' },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: '900', textAlign: 'center', marginTop: 8 },
  emptyText: { color: GRAY, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  errorBox: { gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', marginBottom: 12 },
  errorText: { color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  retryButton: { alignSelf: 'flex-start', backgroundColor: RED, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  historySection: { marginTop: 18 },
  historyTitle: { color: TEXT, fontSize: 13, fontWeight: '900', marginBottom: 8, paddingHorizontal: 2 },
  historyRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 13, padding: 12, marginBottom: 8 },
  historyIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#DCFCE7', color: '#15803D', fontSize: 13, fontWeight: '900', textAlign: 'center', lineHeight: 26 },
  historyCopy: { flex: 1 },
  historyOrder: { color: TEXT, fontSize: 12, fontWeight: '800' },
  historyMeta: { color: GRAY, fontSize: 10, marginTop: 2 },
  mapModal: { flex: 1, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  mapHeaderSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  mapHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginTop: 8, padding: 11, borderRadius: 14, backgroundColor: '#FFFFFF', elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  mapBackButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F0F3', alignItems: 'center', justifyContent: 'center' },
  mapBackText: { color: TEXT, fontSize: 17, fontWeight: '900' },
  mapHeaderCopy: { flex: 1 },
  mapHeaderTitle: { color: TEXT, fontSize: 13, fontWeight: '900' },
  mapHeaderSubtitle: { color: GRAY, fontSize: 10, marginTop: 2 },
  mapBottomCard: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 26, elevation: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: -3 } },
  mapBottomRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  mapBottomCopy: { flex: 1 },
  mapBottomLabel: { color: GRAY, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  mapBottomName: { color: TEXT, fontSize: 14, fontWeight: '900', marginTop: 4 },
  mapBottomAddress: { color: GRAY, fontSize: 11, lineHeight: 15, marginTop: 2 },
  simulateButton: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#EFF6FF' },
  simulateButtonActive: { backgroundColor: '#DCFCE7' },
  simulateText: { color: '#1D4ED8', fontSize: 11, fontWeight: '900' },
  completeButton: { marginTop: 13, alignItems: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: GREEN },
  completeButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  mapHint: { marginTop: 13, color: GRAY, fontSize: 11, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
