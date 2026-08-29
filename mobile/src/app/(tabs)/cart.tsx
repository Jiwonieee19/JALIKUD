import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';

const RED = '#DC2626';
const BG = '#F4F4F6';
const CARD = '#FFFFFF';
const TEXT_DARK = '#1C1C1E';
const TEXT_GRAY = '#8E8E93';
const GREEN = '#16A34A';

type CartItem = {
  id: string;
  name: string;
  variant: string;
  addOns?: string;
  instructions?: string;
  quantity: number;
  unitPrice: number;
  emoji: string;
};

// Static cart for now — will be replaced by cart state from the menu tab.
const INITIAL_CART: CartItem[] = [
  {
    id: '1',
    name: 'Chickenjoy 1pc',
    variant: 'Regular · Coke Regular',
    addOns: 'Extra Rice (+₱30)',
    quantity: 2,
    unitPrice: 139,
    emoji: '🍗',
  },
  {
    id: '2',
    name: 'Jolly Spaghetti',
    variant: 'Regular',
    instructions: '"no cheese please"',
    quantity: 1,
    unitPrice: 99,
    emoji: '🍝',
  },
  {
    id: '3',
    name: 'Champ Burger',
    variant: 'Large · Iced Tea',
    addOns: 'Extra Cheese (+₱20), Coleslaw (+₱35)',
    quantity: 1,
    unitPrice: 234,
    emoji: '🍔',
  },
];

function peso(value: number): string {
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

// UI only — checkout flow is not implemented yet.
export default function CartScreen() {
  const [items, setItems] = useState<CartItem[]>(INITIAL_CART);
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherApplied, setVoucherApplied] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discount = voucherApplied ? Math.floor(subtotal * 0.5) : 0;
  const deliveryFee = 49;
  const total = subtotal - discount + deliveryFee;
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  const changeQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    );
  };

  const applyVoucher = () => {
    if (voucherInput.trim().toUpperCase() === 'JALI50') {
      setVoucherApplied(true);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Red header: title + item count badge */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleIconBox}>
              <Text style={styles.titleIcon}>🛒</Text>
            </View>
            <Text style={styles.title}>My Cart</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{totalQty}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Cart items */}
        {items.map((item) => (
          <View key={item.id} style={styles.cardRow}>
            <View style={styles.itemImageBox}>
              <Text style={styles.itemEmoji}>{item.emoji}</Text>
            </View>
            <View style={styles.itemInfo}>
              <View style={styles.itemTopRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Pressable
                  onPress={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                  style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                  <Text style={styles.removeIcon}>✕</Text>
                </Pressable>
              </View>
              <Text style={styles.itemVariant}>{item.variant}</Text>
              {item.addOns != null && <Text style={styles.itemMeta}>{item.addOns}</Text>}
              {item.instructions != null && (
                <Text style={styles.itemInstructions}>{item.instructions}</Text>
              )}
              <View style={styles.itemBottomRow}>
                <View style={styles.qtyRow}>
                  <Pressable
                    onPress={() => changeQuantity(item.id, -1)}
                    style={({ pressed }) => [styles.qtyButton, pressed && styles.qtyPressed]}>
                    <Text style={styles.qtyButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <Pressable
                    onPress={() => changeQuantity(item.id, 1)}
                    style={({ pressed }) => [styles.qtyButton, pressed && styles.qtyPressed]}>
                    <Text style={styles.qtyButtonText}>+</Text>
                  </Pressable>
                </View>
                <Text style={styles.itemPrice}>{peso(item.unitPrice * item.quantity)}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Voucher */}
        <View style={styles.card}>
          <View style={styles.voucherTitleRow}>
            <Text style={styles.voucherIcon}>🏷️</Text>
            <Text style={styles.voucherTitle}>Voucher Code</Text>
          </View>
          {voucherApplied ? (
            <View style={styles.voucherAppliedBox}>
              <Text style={styles.voucherAppliedIcon}>✓</Text>
              <Text style={styles.voucherAppliedText}>JALI50 – 50% Off Applied!</Text>
              <Pressable
                onPress={() => {
                  setVoucherApplied(false);
                  setVoucherInput('');
                }}
                style={({ pressed }) => [styles.voucherClear, pressed && styles.pressed]}>
                <Text style={styles.removeIcon}>✕</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.voucherInputRow}>
              <TextInput
                value={voucherInput}
                onChangeText={(text) => setVoucherInput(text.toUpperCase())}
                placeholder="Enter voucher code"
                placeholderTextColor="#C7C7CC"
                style={styles.voucherInput}
                autoCapitalize="characters"
              />
              <Pressable
                onPress={applyVoucher}
                style={({ pressed }) => [styles.voucherApplyButton, pressed && styles.pressed]}>
                <Text style={styles.voucherApplyText}>Apply</Text>
              </Pressable>
            </View>
          )}
          {!voucherApplied && (
            <Text style={styles.voucherHint}>Try JALI50 for 50% off your order!</Text>
          )}
        </View>

        {/* Order summary */}
        <View style={styles.card}>
          <View style={styles.summaryTitleRow}>
            <Text style={styles.summaryIcon}>🧾</Text>
            <Text style={styles.summaryTitle}>Order Summary</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{peso(subtotal)}</Text>
          </View>
          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryDiscountLabel}>Voucher Discount</Text>
              <Text style={styles.summaryDiscountValue}>−{peso(discount)}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryFeeLabel}>Delivery Fee</Text>
            <Text style={styles.summaryFeeValue}>+{peso(deliveryFee)} (est.)</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>{peso(total)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky checkout button */}
      <View style={styles.checkoutBar}>
        <Pressable style={({ pressed }) => [styles.checkoutButton, pressed && styles.pressed]}>
          <Text style={styles.checkoutText}>Checkout · {peso(total)}</Text>
          <Text style={styles.checkoutArrow}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerSafe: { backgroundColor: RED },
  header: { backgroundColor: RED, paddingHorizontal: 16, paddingBottom: 16 },
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
  countBadge: { backgroundColor: '#FDE047', paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999 },
  countText: { fontSize: 12, fontWeight: '800', color: TEXT_DARK },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: BottomTabInset + 100, gap: 12 },
  pressed: { opacity: 0.8 },
  card: { backgroundColor: CARD, borderRadius: 14, padding: 12 },
  cardRow: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  itemImageBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#FDEBD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: { fontSize: 32 },
  itemInfo: { flex: 1, gap: 2 },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemName: { flex: 1, fontSize: 15, fontWeight: '700', color: TEXT_DARK },
  removeButton: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  removeIcon: { fontSize: 14, color: '#C7C7CC' },
  itemVariant: { fontSize: 12, color: TEXT_GRAY },
  itemMeta: { fontSize: 12, color: TEXT_GRAY },
  itemInstructions: { fontSize: 12, fontStyle: 'italic', color: TEXT_GRAY },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyPressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
  qtyButtonText: { fontSize: 16, lineHeight: 18, fontWeight: '700', color: '#FFFFFF' },
  qtyValue: { minWidth: 18, textAlign: 'center', fontSize: 14, fontWeight: '700', color: TEXT_DARK },
  itemPrice: { fontSize: 15, fontWeight: '800', color: RED },
  voucherTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  voucherIcon: { fontSize: 14 },
  voucherTitle: { fontSize: 14, fontWeight: '700', color: TEXT_DARK },
  voucherInputRow: { flexDirection: 'row', gap: 8 },
  voucherInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E4E4E9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    color: TEXT_DARK,
  },
  voucherApplyButton: {
    backgroundColor: RED,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherApplyText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  voucherAppliedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  voucherAppliedIcon: { fontSize: 14, color: GREEN, fontWeight: '800' },
  voucherAppliedText: { flex: 1, fontSize: 13, fontWeight: '700', color: GREEN },
  voucherClear: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  voucherHint: { marginTop: 8, fontSize: 11, color: TEXT_GRAY },
  summaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  summaryIcon: { fontSize: 14 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: TEXT_DARK },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: 13, color: TEXT_GRAY },
  summaryValue: { fontSize: 13, fontWeight: '600', color: TEXT_DARK },
  summaryDiscountLabel: { fontSize: 13, color: GREEN },
  summaryDiscountValue: { fontSize: 13, fontWeight: '700', color: GREEN },
  summaryFeeLabel: { fontSize: 12, color: TEXT_GRAY },
  summaryFeeValue: { fontSize: 12, color: TEXT_GRAY },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F3',
    marginTop: 6,
    paddingTop: 10,
  },
  summaryTotalLabel: { fontSize: 15, fontWeight: '800', color: TEXT_DARK },
  summaryTotalValue: { fontSize: 16, fontWeight: '800', color: RED },
  checkoutBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F3',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: RED,
    paddingVertical: 16,
    borderRadius: 16,
  },
  checkoutText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  checkoutArrow: { fontSize: 20, lineHeight: 22, fontWeight: '700', color: '#FFFFFF' },
});


