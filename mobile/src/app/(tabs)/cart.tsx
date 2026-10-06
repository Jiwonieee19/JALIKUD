import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useCustomerOrder, pointsForTotal } from '@/context/customer-order-context';

const RED = '#DC2626';
const BG = '#F4F4F6';
const CARD = '#FFFFFF';
const TEXT_DARK = '#1C1C1E';
const TEXT_GRAY = '#8E8E93';
const GREEN = '#16A34A';

function peso(value: number): string {
  return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export default function CartScreen() {
  const router = useRouter();
  const { cartItems, changeQuantity, removeFromCart, placeOrder } = useCustomerOrder();
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherApplied, setVoucherApplied] = useState(false);

  const subtotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discount = voucherApplied ? Math.floor(subtotal * 0.5) : 0;
  const deliveryFee = cartItems.length > 0 ? 49 : 0;
  const total = subtotal - discount + deliveryFee;
  const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const applyVoucher = () => {
    if (voucherInput.trim().toUpperCase() === 'JALI50') {
      setVoucherApplied(true);
    }
  };

  const handlePlaceOrder = () => {
    const order = placeOrder(total);
    if (!order) return;
    setVoucherApplied(false);
    setVoucherInput('');
    router.replace('/(tabs)/orders');
  };
  const earnPreview = pointsForTotal(total);

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
        {cartItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptyMessage}>Add items from the menu to place an order.</Text>
          </View>
        ) : (
          cartItems.map((item) => (
            <View key={item.id} style={styles.cardRow}>
              <View style={styles.itemImageBox}>
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.itemInfo}>
                <View style={styles.itemTopRow}>
                  <View style={styles.itemNameWrap}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.source === 'reward' && (
                      <View style={styles.rewardBadge}>
                        <Text style={styles.rewardBadgeText}>REWARD</Text>
                      </View>
                    )}
                    {item.source === 'deal' && (
                      <View style={styles.dealBadge}>
                        <Text style={styles.dealBadgeText}>DEAL</Text>
                      </View>
                    )}
                  </View>
                  <Pressable
                    onPress={() => removeFromCart(item.id)}
                    style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                    <Text style={styles.removeIcon}>✕</Text>
                  </Pressable>
                </View>
                <Text style={styles.itemVariant}>{item.variant}</Text>
                <View style={styles.itemBottomRow}>
                  <View style={styles.qtyRow}>
                    <Pressable
                      onPress={() => changeQuantity(item.id, -1)}
                      style={({ pressed }) => [styles.qtyButton, pressed && styles.qtyPressed]}>
                      <Text style={styles.qtyButtonText}>−</Text>
                    </Pressable>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                    <Pressable
                      disabled={item.maxQuantity != null && item.quantity >= item.maxQuantity}
                      onPress={() => changeQuantity(item.id, 1)}
                      style={({ pressed }) => [
                        styles.qtyButton,
                        item.maxQuantity != null && item.quantity >= item.maxQuantity && styles.qtyButtonDisabled,
                        pressed && styles.qtyPressed,
                      ]}>
                      <Text style={styles.qtyButtonText}>+</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.itemPrice}>{peso(item.unitPrice * item.quantity)}</Text>
                </View>
              </View>
            </View>
          ))
        )}

        {cartItems.length > 0 && (
          <>
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
              {earnPreview > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.earnLabel}>⭐ You&apos;ll earn {earnPreview} pts on delivery</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky checkout button */}
      {cartItems.length > 0 && (
        <View style={styles.checkoutBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Place order for ${peso(total)}`}
            onPress={handlePlaceOrder}
            style={({ pressed }) => [styles.checkoutButton, pressed && styles.pressed]}>
            <Text style={styles.checkoutText}>Place Order · {peso(total)}</Text>
            <Text style={styles.checkoutArrow}>›</Text>
          </Pressable>
        </View>
      )}
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
  emptyBox: { alignItems: 'center', paddingVertical: 72, gap: 6 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TEXT_DARK },
  emptyMessage: { fontSize: 13, color: TEXT_GRAY, textAlign: 'center' },
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
  itemNameWrap: { flex: 1, alignItems: 'flex-start', gap: 4 },
  itemName: { fontSize: 15, fontWeight: '700', color: TEXT_DARK },
  rewardBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  rewardBadgeText: { fontSize: 9, fontWeight: '800', color: '#15803D' },
  dealBadge: { backgroundColor: '#FFEDD5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  dealBadgeText: { fontSize: 9, fontWeight: '800', color: '#C2410C' },
  removeButton: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  removeIcon: { fontSize: 14, color: '#C7C7CC' },
  itemVariant: { fontSize: 12, color: TEXT_GRAY },
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
  qtyButtonDisabled: { backgroundColor: '#C7C7CC' },
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
  earnLabel: { fontSize: 12, fontWeight: '700', color: GREEN },
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


