import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCustomerOrder, type CustomerPaymentMethod } from '@/context/customer-order-context';
import { errorMessage, isApiError } from '@/lib/api';
import type { CouponDetails } from '@/lib/customer-api';

const RED = '#DC2626'; const BG = '#F4F4F6'; const CARD = '#FFFFFF'; const TEXT = '#1C1C1E'; const GRAY = '#74747C';
const peso = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function couponDescription(coupon: CouponDetails): string {
  const value = Number(coupon.value);
  const discount = coupon.type === 'fixed'
    ? `${peso(value)} off`
    : `${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}% off`;
  const cap = coupon.max_discount_amount === null ? '' : ` · Maximum discount ${peso(Number(coupon.max_discount_amount))}`;

  return `${discount} · Minimum spend ${peso(Number(coupon.min_order_amount))}${cap}`;
}

function minimumCouponFeedback(error: unknown): string | null {
  if (!isApiError(error) || typeof error.response !== 'object' || error.response === null) return null;
  const response = error.response as { coupon?: CouponDetails; required_additional_amount?: string };
  if (!response.coupon || response.required_additional_amount === undefined) return null;

  return `${couponDescription(response.coupon)} · Add ${peso(Number(response.required_additional_amount))} more to apply.`;
}

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cart, cartItems, addresses, changeQuantity, removeFromCart, applyCoupon, clearCoupon, placeOrder, mutating, error, refreshCart, refreshAddresses, clearReward, clearError, updateCartOrderType } = useCustomerOrder();
  const [coupon, setCoupon] = useState('');
  const [couponFeedback, setCouponFeedback] = useState('');
  const [notes, setNotes] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [addressId, setAddressId] = useState<number>();
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod>('cod');
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const summaryY = useRef(0);
  const selectedAddressId = addressId ?? addresses.find((item) => item.is_default)?.id ?? addresses[0]?.id;

  const subtotal = Number(cart?.subtotal ?? 0);
  const discount = Number(cart?.discount_amount ?? 0);
  const rewardDiscount = Number(cart?.reward_discount_amount ?? 0);
  const delivery = orderType === 'delivery' ? Number(cart?.delivery_fee ?? 0) : 0;
  const tax = Number(cart?.tax_amount ?? 0);
  const computedTotal = Math.max(0, subtotal - discount - rewardDiscount + delivery + tax);
  // Server total is the source of truth; fall back to the client sum only
  // when the payload predates the pricing fields.
  const serverTotal = cart?.total_amount === undefined || cart?.total_amount === null
    ? null
    : Number(cart.total_amount);
  const total = Number.isFinite(serverTotal) ? Number(serverTotal) : computedTotal;
  const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const displayedLinesSum = Math.round(cartItems.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  // Server values are the only truth shown here. Priced lines with a zero
  // server subtotal cannot come from one fresh response (subtotal = Σ lines),
  // so that shape only means the payload is stale — surface a muted caption,
  // never substitute local numbers.
  const outOfSync = cartItems.length > 0 && subtotal === 0 && displayedLinesSum > 0;
  const canCheckout = !mutating && !refreshing && cartItems.length > 0 && (orderType === 'delivery' ? !!selectedAddressId : true);
  const pricingErrors = cart?.pricing_errors ?? [];
  const staleItemIds = cartItems.filter((item) => item.lineTotal <= 0).map((item) => item.id);
  const [clearingStale, setClearingStale] = useState(false);

  const selectOrderType = (type: 'delivery' | 'pickup') => {
    setOrderType(type);
    if (type === 'pickup') setPaymentMethod('gcash');
    void updateCartOrderType(type).catch(() => undefined);
  };

  async function clearUnavailable() {
    if (staleItemIds.length === 0 || mutating || clearingStale) return;
    setClearingStale(true);
    try {
      for (const id of staleItemIds) {
        await removeFromCart(id);
      }
      await refreshCart();
    } catch {
      // removeFromCart already surfaces failures via context `error`.
    } finally {
      setClearingStale(false);
    }
  }

  async function checkout() {
    if (!canCheckout) return;
    try {
      await placeOrder({ orderType, addressId: selectedAddressId, couponCode: cart?.coupon?.code, notes: notes.trim() || undefined, paymentMethod });
      router.replace('/(tabs)/orders');
    } catch {
      // placeOrder already stores the message in context `error`; stay on cart
      // and bring the summary (with the error) into view.
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: summaryY.current, animated: true }));
    }
  }

  async function submitCoupon() {
    try {
      await applyCoupon(coupon);
      setCoupon('');
      setCouponFeedback('');
    } catch (caught) {
      setCouponFeedback(minimumCouponFeedback(caught) ?? errorMessage(caught));
      clearError();
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([refreshCart(), refreshAddresses()])
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  }, [refreshAddresses, refreshCart]);

  // Re-sync whenever the tab regains focus — the cart has no other refetch
  // path, so a stale payload could otherwise sit here indefinitely.
  useFocusEffect(useCallback(() => {
    void Promise.all([refreshCart(), refreshAddresses()]).catch(() => undefined);
    return () => {
      setCoupon('');
      setCouponFeedback('');
    };
  }, [refreshAddresses, refreshCart]));

  useEffect(() => {
    if (__DEV__) {
      console.log('[cart] sync', JSON.stringify({
        items: cartItems.length,
        displayedLinesSum,
        subtotal: cart?.subtotal,
        deliveryFee: cart?.delivery_fee,
        tax: cart?.tax_amount,
        total: cart?.total_amount,
        pricingErrors: cart?.pricing_errors,
      }));
    }
  }, [cart?.delivery_fee, cart?.pricing_errors, cart?.subtotal, cart?.tax_amount, cart?.total_amount, cartItems.length, displayedLinesSum]);

  return <View style={styles.container}>
    <StatusBar style="light" />
    <SafeAreaView edges={['top']} style={styles.headerSafe}><View style={styles.header}>
      <Text style={styles.title}>🛒 My Cart</Text><Text style={styles.badge}>{count}</Text>
    </View></SafeAreaView>
    <KeyboardAvoidingView
      style={styles.body}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={RED} />}
        showsVerticalScrollIndicator={false}>
      {cartItems.length === 0 ? <View style={styles.empty}><Text style={styles.emptyIcon}>🛒</Text><Text style={styles.cardTitle}>Your cart is empty</Text><Text style={styles.muted}>Add available products from the live menu.</Text></View> : <>
        {cartItems.map((item) => <View key={item.id} style={styles.cardRow}>
          <Text style={styles.emoji}>{item.emoji}</Text><View style={styles.itemCopy}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.muted}>{item.variant}</Text>
          {item.lineTotal <= 0 && <Text style={styles.error}>No longer available — remove it to restore totals.</Text>}
          <View style={styles.quantity}><Pressable disabled={mutating} onPress={() => void changeQuantity(item.id, -1).catch(() => undefined)} style={styles.circle}><Text style={styles.circleText}>−</Text></Pressable><Text style={styles.qty}>{item.quantity}</Text><Pressable disabled={mutating} onPress={() => void changeQuantity(item.id, 1).catch(() => undefined)} style={styles.circle}><Text style={styles.circleText}>+</Text></Pressable></View></View>
          <View style={styles.priceCopy}><Text style={styles.price}>{peso(item.lineTotal)}</Text><Pressable disabled={mutating} onPress={() => void removeFromCart(item.id).catch(() => undefined)}><Text style={styles.remove}>Remove</Text></Pressable></View>
        </View>)}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coupon</Text>
          {cart?.coupon ? <>
            <View style={styles.summary}>
              <Text style={styles.success}>✓ {cart.coupon.code} applied</Text>
              <Pressable disabled={mutating} onPress={() => void clearCoupon().catch(() => undefined)}><Text style={styles.remove}>Remove</Text></Pressable>
            </View>
            <Text style={styles.couponDescription}>{couponDescription(cart.coupon)}</Text>
          </> : <>
            <View style={styles.inputRow}><TextInput style={styles.input} autoCapitalize="none" autoCorrect={false} autoComplete="off" maxLength={50} placeholder="e.g. JALI10" value={coupon} onChangeText={(text) => { setCoupon(text); setCouponFeedback(''); }} /><Pressable disabled={mutating || !coupon.trim()} onPress={() => void submitCoupon()} style={styles.apply}><Text style={styles.applyText}>Apply</Text></Pressable></View>
            {!!couponFeedback && <Text style={styles.couponFeedback}>{couponFeedback}</Text>}
          </>}
        </View>

        <View style={styles.card}><Text style={styles.cardTitle}>Fulfillment</Text><View style={styles.typeRow}>{(['delivery', 'pickup'] as const).map((type) => <Pressable key={type} onPress={() => selectOrderType(type)} style={[styles.type, orderType === type && styles.typeActive]}><Text style={[styles.typeText, orderType === type && styles.typeTextActive]}>{type === 'delivery' ? 'Delivery' : 'Pickup'}</Text></Pressable>)}</View>
          {orderType === 'delivery' && <View style={styles.addresses}>{addresses.map((address) => <Pressable key={address.id} onPress={() => setAddressId(address.id)} style={[styles.address, selectedAddressId === address.id && styles.addressActive]}><Text style={styles.addressTitle}>{address.label || 'Address'}{address.is_default ? ' · Default' : ''}</Text><Text style={styles.muted}>{address.line1}, {address.city}</Text></Pressable>)}{addresses.length === 0 && <Text style={styles.error}>Add a delivery address in Settings before checkout.</Text>}</View>}
          <TextInput style={[styles.input, styles.notes]} placeholder="Order notes (optional)" value={notes} onChangeText={setNotes} multiline />
        </View>

        <View style={styles.card} onLayout={(event) => { summaryY.current = event.nativeEvent.layout.y; }}>
          <Text style={styles.cardTitle}>Order Summary</Text>
          <Summary label="Subtotal" value={subtotal} />
          {discount > 0 && <Summary label="Discount" value={-discount} accent />}
          {rewardDiscount > 0 && <Summary label={`Reward${cart?.reward ? ` (${cart.reward.label})` : ''}`} value={-rewardDiscount} accent />}
          {cart?.reward && (
            <View style={styles.summary}>
              <Text style={styles.success}>✓ {cart.reward.label} applied</Text>
              <Pressable disabled={mutating} onPress={() => void clearReward().catch(() => undefined)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          )}
          {orderType === 'delivery' && (
            delivery > 0
              ? <Summary label="Delivery fee" value={delivery} />
              : <View style={styles.summary}><Text style={styles.muted}>Delivery fee</Text><Text style={styles.free}>FREE</Text></View>
          )}
          <Summary label="Tax" value={tax} />
          <View style={styles.totalRow}><Text style={styles.totalLabel}>Total</Text><Text style={styles.total}>{peso(total)}</Text></View>
          {outOfSync && <Text style={styles.muted}>Pull down to refresh for confirmed totals.</Text>}
          <View style={styles.paymentBlock}>
            <Text style={styles.paymentTitle}>Payment</Text>
            <View style={styles.typeRow}>
              {(['cod', 'gcash'] as const).map((method) => (
                <Pressable
                  key={method}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: paymentMethod === method, disabled: orderType === 'pickup' && method === 'cod' }}
                  accessibilityLabel={method === 'cod' ? (orderType === 'pickup' ? 'Cash on Delivery unavailable for pickup' : 'Pay with Cash on Delivery') : 'Pay with GCash'}
                  disabled={orderType === 'pickup' && method === 'cod'}
                  onPress={() => setPaymentMethod(method)}
                  style={[styles.type, orderType === 'pickup' && method === 'cod' && styles.typeDisabled, paymentMethod === method && styles.typeActive]}>
                  <Text style={[styles.typeText, orderType === 'pickup' && method === 'cod' && styles.typeTextDisabled, paymentMethod === method && styles.typeTextActive]}>
                    {method === 'cod' ? (orderType === 'pickup' ? '💵 COD unavailable' : '💵 COD') : '📱 GCash'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {orderType === 'pickup' && <Text style={styles.paymentNotice}>Pickup orders require GCash; COD is unavailable.</Text>}
            <Text style={styles.muted}>
              {paymentMethod === 'cod'
                ? 'Pay in cash on handover. Order stays unpaid until then.'
                : 'GCash payment is automatically confirmed in this demo.'}
            </Text>
          </View>
          {pricingErrors.map((message) => <Text key={message} style={styles.error}>⚠ {message}</Text>)}
          {staleItemIds.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove unavailable items from cart"
              disabled={mutating || clearingStale}
              onPress={() => void clearUnavailable()}
              style={[styles.clearStale, (mutating || clearingStale) && styles.disabled]}>
              {clearingStale ? <ActivityIndicator color="#B91C1C" /> : <Text style={styles.clearStaleText}>Remove unavailable items ({staleItemIds.length})</Text>}
            </Pressable>
          )}
          {!!error && <Text style={styles.error}>⚠ {error}</Text>}
        </View>
      </>}
      </ScrollView>
      {cartItems.length > 0 && (
        <View style={[styles.checkoutBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Place order for ${peso(total)} with ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'GCash'}`}
            disabled={!canCheckout}
            onPress={() => void checkout()}
            style={[styles.checkout, !canCheckout && styles.disabled]}>
            {mutating ? <ActivityIndicator color="#FFF" /> : <Text style={styles.checkoutText}>Place Order · {peso(total)}</Text>}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  </View>;
}

function Summary({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  const formatted = value < 0 ? `−${peso(Math.abs(value))}` : peso(value);
  return <View style={styles.summary}><Text style={[styles.muted, accent && styles.success]}>{label}</Text><Text style={[styles.summaryValue, accent && styles.success]}>{formatted}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG }, headerSafe: { backgroundColor: RED }, header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }, title: { color: '#FFF', fontSize: 22, fontWeight: '900' }, badge: { color: TEXT, backgroundColor: '#FDE047', fontWeight: '900', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
  body: { flex: 1 }, scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 12 }, empty: { alignItems: 'center', paddingVertical: 70, gap: 6 }, emptyIcon: { fontSize: 54 }, card: { backgroundColor: CARD, borderRadius: 15, padding: 14, gap: 11 }, cardTitle: { color: TEXT, fontSize: 16, fontWeight: '900' }, muted: { color: GRAY, fontSize: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: CARD, borderRadius: 15, padding: 12 }, emoji: { fontSize: 38 }, itemCopy: { flex: 1, gap: 3 }, itemName: { color: TEXT, fontSize: 14, fontWeight: '800' }, priceCopy: { alignItems: 'flex-end', gap: 10 }, price: { color: RED, fontWeight: '900' }, remove: { color: RED, fontSize: 11, fontWeight: '700' }, quantity: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 5 }, circle: { width: 25, height: 25, borderRadius: 13, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' }, circleText: { color: '#FFF', fontWeight: '900' }, qty: { minWidth: 16, textAlign: 'center', fontWeight: '800' },
  inputRow: { flexDirection: 'row', gap: 8 }, input: { flex: 1, borderWidth: 1, borderColor: '#E4E4E9', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: TEXT }, apply: { backgroundColor: RED, borderRadius: 11, justifyContent: 'center', paddingHorizontal: 18 }, applyText: { color: '#FFF', fontWeight: '800' }, couponDescription: { color: GRAY, fontSize: 12, lineHeight: 18 }, couponFeedback: { color: '#B45309', fontSize: 12, fontWeight: '700', lineHeight: 18 }, success: { color: '#15803D', fontWeight: '800' }, typeRow: { flexDirection: 'row', gap: 8 }, type: { flex: 1, borderWidth: 1, borderColor: '#DDD', borderRadius: 10, alignItems: 'center', padding: 10 }, typeActive: { backgroundColor: RED, borderColor: RED }, typeDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' }, typeText: { color: TEXT, fontWeight: '700' }, typeTextActive: { color: '#FFF' }, typeTextDisabled: { color: GRAY }, addresses: { gap: 7 }, address: { borderWidth: 1, borderColor: '#E4E4E9', borderRadius: 11, padding: 10 }, addressActive: { borderColor: RED, backgroundColor: '#FEF2F2' }, addressTitle: { color: TEXT, fontSize: 13, fontWeight: '800' }, notes: { minHeight: 65 },
  summary: { flexDirection: 'row', justifyContent: 'space-between' }, summaryValue: { color: TEXT, fontSize: 12, fontWeight: '700' }, free: { color: '#15803D', fontSize: 12, fontWeight: '800' }, paymentBlock: { gap: 8, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10 }, paymentTitle: { color: TEXT, fontSize: 13, fontWeight: '800' }, paymentNotice: { color: '#B45309', fontSize: 12, fontWeight: '700' }, clearStale: { borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, alignItems: 'center' }, clearStaleText: { color: '#B91C1C', fontSize: 12, fontWeight: '800' }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 10 }, totalLabel: { color: TEXT, fontWeight: '900' }, total: { color: RED, fontSize: 17, fontWeight: '900' }, error: { color: '#B91C1C', fontSize: 12, fontWeight: '700' }, checkoutBar: { backgroundColor: CARD, padding: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEE' }, checkout: { backgroundColor: RED, borderRadius: 14, padding: 16, alignItems: 'center' }, checkoutText: { color: '#FFF', fontWeight: '900' }, disabled: { opacity: 0.45 },
});
