import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useAuthDemo } from '@/context/auth-demo-context';
import { useStaffDemo, type StaffActivity } from '@/context/staff-demo-context';

const RED = '#DC2626';
const BG = '#F4F4F6';
const TEXT = '#1C1C1E';
const GRAY = '#74747C';

const ACTIVITY_APPEARANCE: Record<StaffActivity['kind'], { icon: string; bg: string; color: string }> = {
  order_confirmed: { icon: '✓', bg: '#DCFCE7', color: '#15803D' },
  order_rejected: { icon: '✕', bg: '#FEE2E2', color: '#B91C1C' },
  menu_reported: { icon: '!', bg: '#FEF3C7', color: '#B45309' },
  menu_restored: { icon: '↻', bg: '#DBEAFE', color: '#1D4ED8' },
  rider_assigned: { icon: '🛵', bg: '#FFEDD5', color: '#C2410C' },
};

export default function StaffActivityScreen() {
  const { activities } = useStaffDemo();
  const { signOut } = useAuthDemo();
  const router = useRouter();
  const adminNotifications = activities.filter((activity) => activity.recipient === 'Admin').length;

  const handleExitDemo = () => {
    signOut();
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>STAFF WORKSPACE</Text>
              <Text style={styles.title}>Activity</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out and exit staff demo"
              onPress={handleExitDemo}
              style={({ pressed }) => [styles.exitButton, pressed && styles.pressed]}>
              <Text style={styles.exitText}>Exit Demo</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>A local record of order decisions and menu reports.</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.demoNotice}>
          <View style={styles.demoNoticeIcon}><Text style={styles.demoNoticeIconText}>i</Text></View>
          <View style={styles.demoNoticeCopy}>
            <Text style={styles.demoNoticeTitle}>UI demonstration</Text>
            <Text style={styles.demoNoticeText}>Admin notifications shown here are stored only in memory. No push notification or API request is sent.</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}><Text style={styles.summaryIcon}>📋</Text><Text style={styles.summaryNumber}>{activities.length}</Text><Text style={styles.summaryLabel}>Total actions</Text></View>
          <View style={styles.summaryCard}><Text style={styles.summaryIcon}>🔔</Text><Text style={styles.summaryNumber}>{adminNotifications}</Text><Text style={styles.summaryLabel}>Admin alerts</Text></View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <Text style={styles.sectionMeta}>Newest first</Text>
        </View>

        <View style={styles.timeline}>
          {activities.map((activity, index) => {
            const appearance = ACTIVITY_APPEARANCE[activity.kind];
            return (
              <View key={activity.id} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.activityIcon, { backgroundColor: appearance.bg }]}>
                    <Text style={[styles.activityIconText, { color: appearance.color }]}>{appearance.icon}</Text>
                  </View>
                  {index < activities.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.activityCard}>
                  <View style={styles.activityTop}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                  <Text style={styles.activityDetail}>{activity.detail}</Text>
                  {activity.recipient && (
                    <View style={styles.recipientBadge}>
                      <Text style={styles.recipientIcon}>🔔</Text>
                      <Text style={styles.recipientText}>Admin notified · local demo</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  headerSafe: { backgroundColor: RED },
  header: { paddingHorizontal: 16, paddingBottom: 17 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 3 },
  subtitle: { color: 'rgba(255,255,255,0.76)', fontSize: 11, marginTop: 4 },
  exitButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.17)' },
  exitText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  content: { padding: 14, paddingBottom: BottomTabInset + 24 },
  demoNotice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 13, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  demoNoticeIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  demoNoticeIconText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  demoNoticeCopy: { flex: 1 },
  demoNoticeTitle: { color: '#1E3A8A', fontSize: 12, fontWeight: '900' },
  demoNoticeText: { color: '#1E40AF', fontSize: 10, lineHeight: 15, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 13, padding: 12 },
  summaryIcon: { fontSize: 18 },
  summaryNumber: { color: TEXT, fontSize: 22, fontWeight: '900', marginTop: 6 },
  summaryLabel: { color: GRAY, fontSize: 10, marginTop: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 11, paddingHorizontal: 2 },
  sectionTitle: { color: TEXT, fontSize: 15, fontWeight: '900' },
  sectionMeta: { color: GRAY, fontSize: 9 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineRail: { width: 34, alignItems: 'center' },
  activityIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  activityIconText: { fontSize: 14, fontWeight: '900' },
  timelineLine: { flex: 1, width: 2, minHeight: 18, backgroundColor: '#D9D9DE' },
  activityCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 13, padding: 12, marginBottom: 11 },
  activityTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  activityTitle: { flex: 1, color: TEXT, fontSize: 12, fontWeight: '800', lineHeight: 16 },
  activityTime: { color: GRAY, fontSize: 9 },
  activityDetail: { color: GRAY, fontSize: 10, lineHeight: 15, marginTop: 5 },
  recipientBadge: { alignSelf: 'flex-start', flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 4, paddingHorizontal: 7, borderRadius: 999, backgroundColor: '#FEF3C7', marginTop: 8 },
  recipientIcon: { fontSize: 9 },
  recipientText: { color: '#B45309', fontSize: 8, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});