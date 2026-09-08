import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useStaffDemo, type MenuAvailability, type StaffMenuItem } from '@/context/staff-demo-context';

const RED = '#DC2626';
const BG = '#F4F4F6';
const TEXT = '#1C1C1E';
const GRAY = '#74747C';
const CATEGORIES = ['All', 'Chickenjoy', 'Burgers', 'Rice Meals', 'Pasta'];

const AVAILABILITY_COPY: Record<MenuAvailability, { label: string; color: string; bg: string }> = {
  available: { label: 'Available', color: '#15803D', bg: '#DCFCE7' },
  sold_out: { label: 'Sold out', color: '#B91C1C', bg: '#FEE2E2' },
  unavailable: { label: 'Unavailable', color: '#B45309', bg: '#FEF3C7' },
};

function peso(value: number): string {
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export default function StaffMenuScreen() {
  const { menuItems, updateMenuAvailability } = useStaffDemo();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<StaffMenuItem | null>(null);
  const [nextStatus, setNextStatus] = useState<MenuAvailability>('sold_out');
  const [note, setNote] = useState('');
  const [feedback, setFeedback] = useState('');

  const unavailableCount = menuItems.filter((item) => item.availability !== 'available').length;
  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return menuItems.filter((item) =>
      (category === 'All' || item.category === category) && item.name.toLowerCase().includes(term),
    );
  }, [menuItems, category, search]);

  const openStatusSheet = (item: StaffMenuItem) => {
    setSelectedItem(item);
    setNextStatus(item.availability === 'available' ? 'sold_out' : item.availability);
    setNote(item.statusNote ?? '');
  };

  const closeStatusSheet = () => {
    setSelectedItem(null);
    setNextStatus('sold_out');
    setNote('');
  };

  const saveStatus = () => {
    if (!selectedItem) return;
    updateMenuAvailability(selectedItem.id, nextStatus, note);
    const label = AVAILABILITY_COPY[nextStatus].label.toLowerCase();
    setFeedback(`${selectedItem.name} marked ${label}. Admin notification added to Activity.`);
    closeStatusSheet();
  };

  const restoreItem = (item: StaffMenuItem) => {
    updateMenuAvailability(item.id, 'available', '');
    setFeedback(`${item.name} is available again. Admin notification added to Activity.`);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>STORE OPERATIONS</Text>
          <Text style={styles.title}>Menu Availability</Text>
          <Text style={styles.subtitle}>Keep the menu accurate and alert admins about stock issues.</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}><Text style={styles.summaryNumber}>{menuItems.length - unavailableCount}</Text><Text style={styles.summaryLabel}>Available</Text></View>
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
        {CATEGORIES.map((item) => (
          <Pressable key={item} onPress={() => setCategory(item)} style={[styles.category, category === item && styles.categoryActive]}>
            <Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.list} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {feedback ? (
          <Pressable onPress={() => setFeedback('')} style={styles.feedback} accessibilityLabel="Dismiss message">
            <Text style={styles.feedbackIcon}>🔔</Text><Text style={styles.feedbackText}>{feedback}</Text><Text style={styles.feedbackClose}>×</Text>
          </Pressable>
        ) : null}
        <View style={styles.resultRow}><Text style={styles.resultText}>{visibleItems.length} menu items</Text><Text style={styles.demoText}>Local demo data</Text></View>
        {visibleItems.map((item) => {
          const appearance = AVAILABILITY_COPY[item.availability];
          return (
            <View key={item.id} style={[styles.card, item.availability !== 'available' && styles.cardMuted]}>
              <View style={styles.emojiBox}><Text style={styles.emoji}>{item.emoji}</Text></View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>{item.category} · {peso(item.price)}</Text>
                <View style={[styles.availabilityBadge, { backgroundColor: appearance.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: appearance.color }]} />
                  <Text style={[styles.availabilityText, { color: appearance.color }]}>{appearance.label}</Text>
                </View>
                {item.statusNote ? <Text numberOfLines={2} style={styles.statusNote}>{item.statusNote}</Text> : null}
              </View>
              <View style={styles.itemActions}>
                {item.availability === 'available' ? (
                  <Pressable onPress={() => openStatusSheet(item)} style={({ pressed }) => [styles.reportButton, pressed && styles.pressed]}>
                    <Text style={styles.reportButtonText}>Change</Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable onPress={() => restoreItem(item)} style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}>
                      <Text style={styles.restoreButtonText}>Restore</Text>
                    </Pressable>
                    <Pressable accessibilityLabel={`Edit ${item.name} status`} onPress={() => openStatusSheet(item)} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
                      <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        })}
        {!visibleItems.length && <View style={styles.empty}><Text style={styles.emptyIcon}>🔎</Text><Text style={styles.emptyTitle}>No menu items found</Text><Text style={styles.emptyText}>Try another search or category.</Text></View>}
      </ScrollView>

      <Modal transparent animationType="slide" visible={selectedItem != null} onRequestClose={closeStatusSheet}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeStatusSheet} accessibilityLabel="Close status dialog" />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Update {selectedItem?.name}</Text>
            <Text style={styles.modalSubtitle}>The selected status and your note will appear as an Admin notification in Activity.</Text>
            <View style={styles.statusChoices}>
              {(['sold_out', 'unavailable'] as MenuAvailability[]).map((status) => {
                const appearance = AVAILABILITY_COPY[status];
                return (
                  <Pressable key={status} onPress={() => setNextStatus(status)} style={[styles.statusChoice, nextStatus === status && { borderColor: appearance.color, backgroundColor: appearance.bg }]}>
                    <View style={[styles.choiceIcon, { backgroundColor: appearance.bg }]}><Text>{status === 'sold_out' ? '⛔' : '⏸️'}</Text></View>
                    <View style={styles.choiceCopy}><Text style={[styles.choiceTitle, nextStatus === status && { color: appearance.color }]}>{appearance.label}</Text><Text style={styles.choiceDescription}>{status === 'sold_out' ? 'No stock remains for this item' : 'Temporarily pause ordering this item'}</Text></View>
                    <View style={[styles.radio, nextStatus === status && { borderColor: appearance.color }]}>{nextStatus === status && <View style={[styles.radioDot, { backgroundColor: appearance.color }]} />}</View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.inputLabel}>Reason for admin</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Example: Chicken stock arriving at 4 PM"
              placeholderTextColor="#A0A0A8"
              multiline
              maxLength={180}
              style={styles.noteInput}
            />
            <View style={styles.notice}><Text style={styles.noticeIcon}>ⓘ</Text><Text style={styles.noticeText}>Demo only: this creates an in-app activity record. It does not send a real push notification.</Text></View>
            <View style={styles.modalActions}>
              <Pressable onPress={closeStatusSheet} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable onPress={saveStatus} style={({ pressed }) => [styles.notifyButton, pressed && styles.pressed]}><Text style={styles.notifyText}>Update & Notify Admin</Text></Pressable>
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
  statusNote: { color: GRAY, fontSize: 9, marginTop: 4 },
  itemActions: { gap: 6, alignItems: 'stretch' },
  reportButton: { borderWidth: 1, borderColor: '#D8D8DE', borderRadius: 9, paddingVertical: 8, paddingHorizontal: 10 },
  reportButtonText: { color: TEXT, fontSize: 10, fontWeight: '800' },
  restoreButton: { backgroundColor: '#16A34A', borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9 },
  restoreButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  editButton: { alignItems: 'center', paddingVertical: 4 },
  editButtonText: { color: RED, fontSize: 9, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { color: TEXT, fontSize: 17, fontWeight: '900', marginTop: 8 },
  emptyText: { color: GRAY, fontSize: 11, marginTop: 3 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 27, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFFFFF' },
  modalHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#D1D1D6', marginBottom: 15 },
  modalTitle: { color: TEXT, fontSize: 20, fontWeight: '900' },
  modalSubtitle: { color: GRAY, fontSize: 11, lineHeight: 16, marginTop: 4 },
  statusChoices: { gap: 8, marginTop: 14 },
  statusChoice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E0E0E5' },
  choiceIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1 },
  choiceTitle: { color: TEXT, fontSize: 13, fontWeight: '800' },
  choiceDescription: { color: GRAY, fontSize: 9, marginTop: 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#C7C7CC', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  inputLabel: { color: TEXT, fontSize: 11, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  noteInput: { minHeight: 70, borderWidth: 1, borderColor: '#D8D8DE', borderRadius: 11, padding: 10, color: TEXT, fontSize: 12, textAlignVertical: 'top' },
  notice: { flexDirection: 'row', gap: 7, marginTop: 10, padding: 9, borderRadius: 9, backgroundColor: '#F3F4F6' },
  noticeIcon: { color: GRAY, fontSize: 11 },
  noticeText: { flex: 1, color: GRAY, fontSize: 9, lineHeight: 13 },
  modalActions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  cancelButton: { paddingHorizontal: 20, paddingVertical: 13, alignItems: 'center', borderRadius: 11, backgroundColor: '#EEEEF1' },
  cancelText: { color: TEXT, fontSize: 12, fontWeight: '800' },
  notifyButton: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 11, backgroundColor: RED },
  notifyText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});