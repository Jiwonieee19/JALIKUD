import { useEffect, useRef, useState } from 'react';
import { useSegments } from 'expo-router';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useCustomerOrder, type CustomerOrder } from '@/context/customer-order-context';
import { streamChat } from '@/lib/customer-api';

const RED = '#DC2626';
const DARK_RED = '#991B1B';
const TEXT = '#1C1C1E';
const MUTED = '#6B7280';

type ChatMessage = {
  id: number;
  sender: 'bot' | 'user';
  text: string;
};

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery']);

function botReply(question: string, cartCount: number, latestActiveOrder?: CustomerOrder): string {
  const text = question.toLowerCase();

  if (text.includes('track') || text.includes('where') || text.includes('status') || text.includes('order')) {
    if (!latestActiveOrder) return 'You have no active orders right now. New orders and their progress will appear in the Orders tab.';
    const status = latestActiveOrder.status.replaceAll('_', ' ');
    return `${latestActiveOrder.orderNumber} is currently ${status}. Open the Orders tab to see its latest progress.`;
  }
  if (text.includes('delivery') || text.includes('fee') || text.includes('shipping')) {
    return 'The delivery fee is shown in your Order Summary before checkout. Pickup orders have no delivery fee.';
  }
  if (text.includes('gcash') || text.includes('cod') || text.includes('payment') || text.includes('pay')) {
    return 'You can pay by Cash on Delivery or GCash. Choose your preferred option in the Cart before placing your order.';
  }
  if (text.includes('cart')) {
    return cartCount > 0
      ? `You currently have ${cartCount} item${cartCount === 1 ? '' : 's'} in your cart. Open the Cart tab to review your order.`
      : 'Your cart is empty. Add an item from the Menu to start an order.';
  }
  if (text.includes('reward') || text.includes('point')) {
    return 'Open the Rewards tab to view available rewards and apply an eligible reward to your cart.';
  }
  if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
    return 'Hi! I can help with orders, delivery fees, payment options, your cart, and rewards. What would you like to know?';
  }

  return 'I can help with order tracking, delivery fees, COD or GCash, cart questions, and rewards. Try asking one of those topics.';
}

export default function ChatWidget() {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const segments = useSegments();
  const { cartItems, orders } = useCustomerOrder();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [streamingStarted, setStreamingStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, sender: 'bot', text: 'Hi! I am Jali, your ordering assistant. How can I help today?' },
  ]);
  const nextId = useRef(2);
  const scrollRef = useRef<ScrollView>(null);
  const [dragPosition] = useState(() => new Animated.ValueXY());
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [launcherSize, setLauncherSize] = useState({ width: 0, height: 0 });
  const currentRoute = segments[segments.length - 1] as string | undefined;
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const latestActiveOrder = orders.find((order) => ACTIVE_STATUSES.has(order.status));
  const floatingBottom = BottomTabInset + (currentRoute === 'cart' && cartCount > 0 ? 96 : 16);
  const launcherRight = Math.max(insets.right, 16);
  const baseLeft = window.width - launcherRight - launcherSize.width;
  const baseTop = window.height - floatingBottom - launcherSize.height;
  const dragBounds = launcherSize.width && launcherSize.height
    ? {
        minX: Math.max(insets.left, 16) - baseLeft,
        maxX: 0,
        minY: Math.max(insets.top, 16) - baseTop,
        maxY: 0,
      }
    : { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const boundedDragX = Math.max(dragBounds.minX, Math.min(dragBounds.maxX, dragOffset.x));
  const boundedDragY = Math.max(dragBounds.minY, Math.min(dragBounds.maxY, dragOffset.y));
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
    onPanResponderMove: (_, gesture) => {
      const next = {
        x: Math.max(dragBounds.minX, Math.min(dragBounds.maxX, boundedDragX + gesture.dx)),
        y: Math.max(dragBounds.minY, Math.min(dragBounds.maxY, boundedDragY + gesture.dy)),
      };
      dragPosition.setValue(next);
    },
    onPanResponderRelease: (_, gesture) => {
      const released = {
        x: Math.max(dragBounds.minX, Math.min(dragBounds.maxX, boundedDragX + gesture.dx)),
        y: Math.max(dragBounds.minY, Math.min(dragBounds.maxY, boundedDragY + gesture.dy)),
      };
      const snapped = {
        x: released.x < (dragBounds.minX + dragBounds.maxX) / 2 ? dragBounds.minX : dragBounds.maxX,
        y: released.y,
      };
      dragPosition.setValue(snapped);
      setDragOffset(snapped);
    },
    onPanResponderTerminate: () => {
      dragPosition.setValue({ x: boundedDragX, y: boundedDragY });
    },
  });

  useEffect(() => {
    dragPosition.setValue({ x: boundedDragX, y: boundedDragY });
  }, [boundedDragX, boundedDragY, dragPosition]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages, thinking, open]);

  async function sendMessage(value: string) {
    const question = value.trim();
    if (!question || thinking) return;

    setDraft('');
    setThinking(true);
    setStreamingStarted(false);

    // Keep only the last few turns so the assistant has short-term context.
    const history: { role: 'user' | 'assistant'; content: string }[] = messages
      .slice(-6)
      .map((message) => ({ role: message.sender === 'user' ? 'user' : 'assistant', content: message.text }));

    const userId = nextId.current++;
    const botId = nextId.current++;

    setMessages((current) => [...current, { id: userId, sender: 'user', text: question }]);

    let reply = '';

    const upsertBot = (text: string) => {
      setMessages((current) =>
        current.some((message) => message.id === botId)
          ? current.map((message) => (message.id === botId ? { ...message, text } : message))
          : [...current, { id: botId, sender: 'bot', text }],
      );
    };

    try {
      if (!token) throw new Error('not authenticated');

      await streamChat(token, { message: question, history }, (event) => {
        if (typeof event.token === 'string') {
          setStreamingStarted(true);
          reply += event.token;
          upsertBot(reply);
        }
      });

      if (!reply.trim()) throw new Error('empty reply');
    } catch {
      // Fall back to the local rule-based answers when the assistant is down.
      reply = botReply(question, cartCount, latestActiveOrder);
      upsertBot(reply);
    } finally {
      setThinking(false);
      setStreamingStarted(false);
    }
  }

  return (
    <>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Animated.View
          {...panResponder.panHandlers}
          onLayout={(event) => setLauncherSize(event.nativeEvent.layout)}
          style={[styles.launcherPosition, { bottom: floatingBottom, right: launcherRight, transform: dragPosition.getTranslateTransform() }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Ask Jali chatbot. Drag to reposition."
            onPress={() => setOpen(true)}
            style={({ pressed }) => [styles.launcher, pressed && styles.pressed]}>
            <View style={styles.launcherIcon}><Text style={styles.launcherEmoji}>💬</Text></View>
            <View>
              <Text style={styles.launcherHint}>NEED HELP?</Text>
              <Text style={styles.launcherText}>Ask Jali</Text>
            </View>
            <View style={styles.onlineDot} />
          </Pressable>
        </Animated.View>
      </View>

      <Modal
        animationType="slide"
        transparent
        statusBarTranslucent
        visible={open}
        onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close chatbot"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.avatar}><Text style={styles.avatarEmoji}>💬</Text></View>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>Ask Jali</Text>
                <View style={styles.statusRow}><View style={styles.statusDot} /><Text style={styles.status}>Ready to help</Text></View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Minimize chatbot"
                hitSlop={10}
                onPress={() => setOpen(false)}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <ScrollView
              ref={scrollRef}
              style={styles.messages}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {messages.map((message) => (
                <View key={message.id} style={[styles.messageRow, message.sender === 'user' && styles.userMessageRow]}>
                  {message.sender === 'bot' && <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>J</Text></View>}
                  <View style={[styles.bubble, message.sender === 'user' ? styles.userBubble : styles.botBubble]}>
                    <Text style={[styles.messageText, message.sender === 'user' && styles.userMessageText]}>{message.text}</Text>
                  </View>
                </View>
              ))}
              {thinking && !streamingStarted && (
                <View style={styles.messageRow}>
                  <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>J</Text></View>
                  <View style={[styles.bubble, styles.botBubble]}>
                    <Text style={[styles.messageText, styles.typingText]}>Typing…</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.composer}>
              <TextInput
                accessibilityLabel="Message Ask Jali"
                autoCorrect
                blurOnSubmit={false}
                maxLength={300}
                onChangeText={setDraft}
                onSubmitEditing={() => sendMessage(draft)}
                placeholder="Ask about your order..."
                placeholderTextColor="#9CA3AF"
                returnKeyType="send"
                style={styles.input}
                value={draft}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                disabled={!draft.trim() || thinking}
                onPress={() => sendMessage(draft)}
                style={({ pressed }) => [styles.send, !draft.trim() && styles.sendDisabled, pressed && styles.pressed]}>
                <Text style={styles.sendText}>➤</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(17, 24, 39, 0.48)' },
  launcherPosition: { position: 'absolute', zIndex: 100 },
  launcher: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: RED,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 26,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 13,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    zIndex: 100,
  },
  launcherIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  launcherEmoji: { fontSize: 19 },
  launcherHint: { color: '#FECACA', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  launcherText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', lineHeight: 17 },
  onlineDot: { position: 'absolute', top: 4, right: 7, width: 10, height: 10, borderRadius: 5, backgroundColor: '#4ADE80', borderWidth: 2, borderColor: DARK_RED },
  pressed: { opacity: 0.76 },
  sheet: {
    height: '82%',
    backgroundColor: '#F8F8FA',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#D1D5DB', marginTop: 9, marginBottom: 7 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: RED },
  avatarEmoji: { fontSize: 23 },
  headerCopy: { flex: 1, marginLeft: 11 },
  title: { color: TEXT, fontSize: 18, fontWeight: '900' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  status: { color: MUTED, fontSize: 12, fontWeight: '600' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#FEE2E2' },
  closeText: { color: DARK_RED, fontSize: 28, fontWeight: '500', lineHeight: 30 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 13 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, paddingRight: 42 },
  userMessageRow: { justifyContent: 'flex-end', paddingRight: 0, paddingLeft: 42 },
  miniAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: RED },
  miniAvatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  bubble: { maxWidth: '88%', borderRadius: 17, paddingHorizontal: 13, paddingVertical: 10 },
  botBubble: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 5, borderWidth: 1, borderColor: '#ECECEF' },
  userBubble: { backgroundColor: RED, borderBottomRightRadius: 5 },
  messageText: { color: TEXT, fontSize: 14, lineHeight: 20 },
  userMessageText: { color: '#FFFFFF', fontWeight: '600' },
  typingText: { color: MUTED },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  input: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 23, paddingHorizontal: 16, color: TEXT, backgroundColor: '#F9FAFB' },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: RED },
  sendDisabled: { opacity: 0.35 },
  sendText: { color: '#FFFFFF', fontSize: 21, fontWeight: '900', marginLeft: 2 },
});
