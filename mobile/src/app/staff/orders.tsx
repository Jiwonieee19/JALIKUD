import { useMemo, useState } from 'react';
import {
  Modal,
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
import { useAuthDemo } from '@/context/auth-demo-context';
import { useDeliveryDemo } from '@/context/delivery-demo-context';
import { useStaffDemo, type StaffOrder, type StaffOrderStatus } from '@/context/staff-demo-context';

const RED = '#DC2626';
const BG = '#F4F4F6';
const TEXT = '#1C1C1E';
const GRAY = '#74747C';
const REJECTION_REASONS = ['Item sold out', 'Item temporarily unavailable', 'Store too busy', 'Other'];

const FILTERS: { value: StaffOrderStatus; label: string }[] = [
  { value: 'incoming', label: 'Incoming' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
];

function peso(value: number): string {
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function OrderCard({
  order,
  onConfirm,
  onReject,
  onAssign,
}: {
  order: StaffOrder;
  onConfirm: () => void;
  onReject: () => void;
  onAssign?: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.orderHeader}>
        <View style={styles.orderHeaderCopy}>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.orderMeta}>{order.receivedAt} · {order.customer}</Text>
        </View>
        <View style={[styles.typeBadge, order.type === 'Pickup' && styles.pickupBadge]}>
          <Text style={[styles.typeText, order.type === 'Pickup' && styles.pickupText]}>
            {order.type === 'Delivery' ? '🛵 ' : '🏪 '}{order.type}
          </Text>
        </View>
      </View>

      <View style={styles.itemsBox}>
        {order.items.map((item) => (
          <View key={`${order.id}-${item.name}`} style={styles.itemRow}>
            <Text style={styles.itemQuantity}>{item.quantity}×</Text>
            <View style={styles.itemCopy}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.note && <Text style={styles.itemNote}>Note: {item.note}</Text>}
            </View>
          </View>
        ))}
      </View>

      {order.status === 'rejected' && (
        <View style={styles.rejectedBox}>
          <Text style={styles.rejectedTitle}>Rejected: {order.rejectionReason}</Text>
          {order.staffNote && <Text style={styles.rejectedNote}>{order.staffNote}</Text>}
        </View>
      )}

      <View style={styles.footer}>
        <View>
          <Text style={styles.totalLabel}>Order total</Text>
          <Text style={styles.total}>{peso(order.total)}</Text>
        </View>
        {order.status === 'incoming' ? (
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reject order ${order.orderNumber}`}
              onPress={onReject}
              style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed]}>
              <Text style={styles.rejectButtonText}>Reject</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Confirm order ${order.orderNumber}`}
              onPress={onConfirm}
              style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}>
              <Text style={styles.confirmButtonText}>✓ Confirm</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.statusBadge, order.status === 'rejected' && styles.statusRejected]}>
            <Text style={[styles.statusBadgeText, order.status === 'rejected' && styles.statusRejectedText]}>
              {order.status === 'confirmed' ? '✓ Confirmed' : '✕ Rejected'}
            </Text>
          </View>
        )}
        {order.status === 'confirmed' && order.type === 'Delivery' && onAssign && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Assign rider for order ${order.orderNumber}`}
            onPress={onAssign}
            style={({ pressed }) => [styles.assignButton, pressed && styles.pressed]}>
            <Text style={styles.assignButtonText}>🛵 Assign rider</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function StaffOrdersScreen() {
  const { riders, assignRider, deliveries } = useDeliveryDemo();
  const { orders, confirmOrder, rejectOrder, addActivity } = useStaffDemo();
  const { current } = useAuthDemo();
  const staffInitials = (current?.name ?? 'ST')
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const [filter, setFilter] = useState<StaffOrderStatus>('incoming');
  const [rejectingOrder, setRejectingOrder] = useState<StaffOrder | null>(null);
  const [assigningOrder, setAssigningOrder] = useState<StaffOrder | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState('');
  const [reason, setReason] = useState(REJECTION_REASONS[0]);
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');

  const counts = useMemo(
    () => ({
      incoming: orders.filter((order) => order.status === 'incoming').length,
      confirmed: orders.filter((order) => order.status === 'confirmed').length,
      rejected: orders.filter((order) => order.status === 'rejected').length,
    }),
    [orders],
  );
  const shownOrders = orders.filter((order) => order.status === filter);

  const handleConfirm = (order: StaffOrder) => {
    confirmOrder(order.id);
    setFeedback(
      order.type === 'Delivery'
        ? `${order.orderNumber} confirmed. Assign a delivery rider when it is ready.`
        : `${order.orderNumber} confirmed. The kitchen can start preparing it.`,
    );
  };

  const openAssignSheet = (order: StaffOrder) => {
    setSelectedRiderId(null);
    setAssignError('');
    setAssigningOrder(order);
  };

  const closeAssignSheet = () => {
    setAssigningOrder(null);
    setSelectedRiderId(null);
    setAssignError('');
  };

  const handleAssign = () => {
    if (!assigningOrder) return;
    const rider = riders.find((candidate) => candidate.id === selectedRiderId);
    if (!rider) {
      setAssignError('Select a rider first.');
      return;
    }
    const matchingDelivery = deliveries.find((delivery) => delivery.status === 'ready');
    const target = matchingDelivery ?? {
      id: `d-${assigningOrder.id}`,
      orderNumber: assigningOrder.orderNumber,
      customer: assigningOrder.customer,
      phone: '0917 000 0000',
      address: 'Customer address on file',
      items: assigningOrder.items.map((item) => ({ name: item.name, quantity: item.quantity })),
      codAmount: assigningOrder.total,
      distanceKm: 5.2,
      deliveryFee: 49,
      status: 'ready' as const,
      riderId: null,
      store: { latitude: 7.1904, longitude: 125.4539 },
      destination: { latitude: 7.0832, longitude: 125.5907, destinationName: "Customer's House" },
      assignedAt: null,
      pickedUpAt: null,
      deliveredAt: null,
    };
    assignRider(target.id, rider.id);
    addActivity({
      kind: 'rider_assigned',
      title: `${rider.name} assigned to ${assigningOrder.orderNumber}`,
      detail: `Delivery · ${assigningOrder.customer} · COD ₱${assigningOrder.total.toLocaleString('en-PH')}`,
    });
    setFeedback(`${rider.name} assigned to ${assigningOrder.orderNumber}. The rider app has been notified.`);
    closeAssignSheet();
  };

  const availableRiders = riders.filter((rider) => rider.status === 'available');

  const closeRejectModal = () => {
    setRejectingOrder(null);
    setReason(REJECTION_REASONS[0]);
    setNote('');
  };

  const handleReject = () => {
    if (!rejectingOrder) return;
    rejectOrder(rejectingOrder.id, reason, note);
    setFeedback(`${rejectingOrder.orderNumber} rejected: ${reason}.`);
    closeRejectModal();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.eyebrow}>SM LANANG PREMIER · JAL-01</Text>
              <Text style={styles.title}>Staff Orders</Text>
            </View>
            <View style={styles.staffBadge}><Text style={styles.staffBadgeText}>{staffInitials}</Text></View>
          </View>
          <View style={styles.queueSummary}>
            <Text style={styles.queueNumber}>{counts.incoming}</Text>
            <View><Text style={styles.queueTitle}>orders need action</Text><Text style={styles.queueHint}>Review newest orders first</Text></View>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => { setFilter(item.value); setFeedback(''); }}
            style={[styles.filter, filter === item.value && styles.filterActive]}>
            <Text style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
              {item.label} ({counts[item.value]})
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {feedback ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss message" onPress={() => setFeedback('')} style={styles.feedback}>
            <Text style={styles.feedbackIcon}>✓</Text><Text style={styles.feedbackText}>{feedback}</Text><Text style={styles.feedbackClose}>×</Text>
          </Pressable>
        ) : null}
        {shownOrders.length ? shownOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onConfirm={() => handleConfirm(order)}
            onReject={() => setRejectingOrder(order)}
            onAssign={order.type === 'Delivery' ? () => openAssignSheet(order) : undefined}
          />
        )) : (
          <View style={styles.empty}><Text style={styles.emptyIcon}>🎉</Text><Text style={styles.emptyTitle}>Queue is clear</Text><Text style={styles.emptyText}>No {filter} orders right now.</Text></View>
        )}
      </ScrollView>

      <Modal visible={rejectingOrder != null} transparent animationType="slide" onRequestClose={closeRejectModal}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeRejectModal} accessibilityLabel="Close rejection dialog" />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Reject {rejectingOrder?.orderNumber}</Text>
            <Text style={styles.modalSubtitle}>Select a reason. This will be recorded in staff activity.</Text>
            <View style={styles.reasonList}>
              {REJECTION_REASONS.map((option) => (
                <Pressable key={option} onPress={() => setReason(option)} style={[styles.reasonOption, reason === option && styles.reasonOptionActive]}>
                  <View style={[styles.radio, reason === option && styles.radioActive]}>{reason === option && <View style={styles.radioDot} />}</View>
                  <Text style={[styles.reasonText, reason === option && styles.reasonTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.inputLabel}>Staff note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add useful details..."
              placeholderTextColor="#A0A0A8"
              multiline
              maxLength={180}
              style={styles.noteInput}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={closeRejectModal} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable>
              <Pressable onPress={handleReject} style={({ pressed }) => [styles.modalRejectButton, pressed && styles.pressed]}><Text style={styles.modalRejectText}>Reject Order</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={assigningOrder != null} transparent animationType="slide" onRequestClose={closeAssignSheet}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeAssignSheet} accessibilityLabel="Close rider assignment dialog" />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Assign rider · {assigningOrder?.orderNumber}</Text>
            <Text style={styles.modalSubtitle}>
              {availableRiders.length
                ? 'Pick an available rider. They will see the delivery in their app.'
                : 'No riders are available right now.'}
            </Text>
            <View style={styles.reasonList}>
              {riders.map((rider) => {
                const selectable = rider.status === 'available';
                const active = selectedRiderId === rider.id;
                return (
                  <Pressable
                    key={rider.id}
                    disabled={!selectable}
                    onPress={() => setSelectedRiderId(rider.id)}
                    style={[styles.riderOption, active && styles.riderOptionActive, !selectable && styles.riderOptionDisabled]}>
                    <View style={styles.riderAvatar}><Text style={styles.riderAvatarText}>🛵</Text></View>
                    <View style={styles.riderCopy}>
                      <Text style={[styles.riderName, !selectable && styles.riderNameDisabled]}>{rider.name}</Text>
                      <Text style={styles.riderMeta}>{rider.vehicle} · {rider.completedToday} today</Text>
                    </View>
                    <View style={[styles.riderStatusChip, rider.status === 'available' && styles.riderStatusAvailable, rider.status === 'on_delivery' && styles.riderStatusBusy]}>
                      <Text style={styles.riderStatusText}>
                        {rider.status === 'available' ? 'Available' : rider.status === 'on_delivery' ? 'Busy' : 'Offline'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {assignError ? <Text style={styles.assignError}>{assignError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable onPress={closeAssignSheet} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable>
              <Pressable onPress={handleAssign} style={({ pressed }) => [styles.modalAssignButton, pressed && styles.pressed]}><Text style={styles.modalAssignText}>Assign rider</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerSafe: { backgroundColor: RED },
  header: { paddingHorizontal: 16, paddingBottom: 18, gap: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 3 },
  staffBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  staffBadgeText: { color: RED, fontSize: 13, fontWeight: '900' },
  queueSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.16)' },
  queueNumber: { color: '#FFFFFF', fontSize: 32, lineHeight: 36, fontWeight: '900' },
  queueTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  queueHint: { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 1 },
  filters: { flexDirection: 'row', gap: 6, padding: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E7E7EB' },
  filter: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  filterActive: { backgroundColor: '#FDE8E8' },
  filterText: { color: GRAY, fontSize: 11, fontWeight: '700' },
  filterTextActive: { color: RED, fontWeight: '900' },
  content: { padding: 14, paddingBottom: BottomTabInset + 24, gap: 12 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 12, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#BBF7D0' },
  feedbackIcon: { color: '#15803D', fontWeight: '900' },
  feedbackText: { flex: 1, color: '#166534', fontSize: 12, fontWeight: '600' },
  feedbackClose: { color: '#15803D', fontSize: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  orderHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  orderHeaderCopy: { flex: 1 },
  orderNumber: { color: TEXT, fontSize: 16, fontWeight: '900' },
  orderMeta: { color: GRAY, fontSize: 11, marginTop: 3 },
  typeBadge: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, backgroundColor: '#E0E7FF' },
  pickupBadge: { backgroundColor: '#FEF3C7' },
  typeText: { color: '#4338CA', fontSize: 10, fontWeight: '800' },
  pickupText: { color: '#B45309' },
  itemsBox: { marginTop: 13, paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEEEF1', gap: 9 },
  itemRow: { flexDirection: 'row', gap: 9 },
  itemQuantity: { width: 24, color: RED, fontSize: 13, fontWeight: '900' },
  itemCopy: { flex: 1 },
  itemName: { color: TEXT, fontSize: 13, fontWeight: '700' },
  itemNote: { color: '#B45309', fontSize: 10, marginTop: 2 },
  rejectedBox: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: '#FEF2F2' },
  rejectedTitle: { color: '#B91C1C', fontSize: 11, fontWeight: '800' },
  rejectedNote: { color: '#991B1B', fontSize: 10, marginTop: 3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  totalLabel: { color: GRAY, fontSize: 9, textTransform: 'uppercase', fontWeight: '700' },
  total: { color: TEXT, fontSize: 17, fontWeight: '900', marginTop: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  rejectButton: { borderWidth: 1, borderColor: '#F0A5A5', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  rejectButtonText: { color: RED, fontSize: 12, fontWeight: '800' },
  confirmButton: { backgroundColor: '#16A34A', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  confirmButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  statusBadge: { backgroundColor: '#DCFCE7', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  statusRejected: { backgroundColor: '#F3F4F6' },
  statusBadgeText: { color: '#15803D', fontSize: 11, fontWeight: '800' },
  statusRejectedText: { color: GRAY },
  pressed: { opacity: 0.72 },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: TEXT, fontSize: 18, fontWeight: '900', marginTop: 10 },
  emptyText: { color: GRAY, fontSize: 12, marginTop: 4 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#D1D1D6', marginBottom: 16 },
  modalTitle: { color: TEXT, fontSize: 20, fontWeight: '900' },
  modalSubtitle: { color: GRAY, fontSize: 12, lineHeight: 17, marginTop: 4 },
  reasonList: { marginTop: 14, gap: 7 },
  reasonOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: '#E4E4E9' },
  reasonOptionActive: { borderColor: RED, backgroundColor: '#FFF5F5' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#C7C7CC', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: RED },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: RED },
  reasonText: { color: TEXT, fontSize: 13, fontWeight: '600' },
  reasonTextActive: { color: RED, fontWeight: '800' },
  inputLabel: { color: TEXT, fontSize: 12, fontWeight: '800', marginTop: 15, marginBottom: 6 },
  noteInput: { minHeight: 78, borderWidth: 1, borderColor: '#D8D8DE', borderRadius: 11, padding: 11, color: TEXT, fontSize: 13, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelButton: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 11, backgroundColor: '#EEEEF1' },
  cancelButtonText: { color: TEXT, fontSize: 13, fontWeight: '800' },
  modalRejectButton: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 11, backgroundColor: RED },
  modalRejectText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  assignButton: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74', paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10 },
  assignButtonText: { color: '#C2410C', fontSize: 11, fontWeight: '900' },
  riderOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: '#E4E4E9' },
  riderOptionActive: { borderColor: RED, backgroundColor: '#FFF5F5' },
  riderOptionDisabled: { opacity: 0.55 },
  riderAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  riderAvatarText: { fontSize: 16 },
  riderCopy: { flex: 1 },
  riderName: { color: TEXT, fontSize: 13, fontWeight: '800' },
  riderNameDisabled: { color: GRAY },
  riderMeta: { color: GRAY, fontSize: 10, marginTop: 2 },
  riderStatusChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F3F4F6' },
  riderStatusAvailable: { backgroundColor: '#DCFCE7' },
  riderStatusBusy: { backgroundColor: '#FEF3C7' },
  riderStatusText: { color: '#374151', fontSize: 9, fontWeight: '800' },
  assignError: { color: RED, fontSize: 11, fontWeight: '700', marginTop: 8 },
  modalAssignButton: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 11, backgroundColor: RED },
  modalAssignText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});