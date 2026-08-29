import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';

const RED = '#DC2626';
const BG = '#F4F4F6';
const CARD = '#FFFFFF';
const TEXT_DARK = '#1C1C1E';
const TEXT_GRAY = '#8E8E93';
const ICON_BG = '#FDE8E8';

// Static profile for now — will come from the backend API later.
const PROFILE = {
  name: 'Maria Santos',
  email: 'maria.santos@email.com',
  phone: '09171234567',
};

type Row = {
  icon: string;
  label: string;
  value?: string;
  danger?: boolean;
};

const NAV_ROWS: Row[] = [
  { icon: '🏠', label: 'Saved Addresses', value: '2 saved' },
  { icon: '🏪', label: 'Default Branch', value: 'JAL-01' },
];

const LINK_ROWS: Row[] = [
  { icon: '❓', label: 'Help & Support' },
  { icon: '🛡️', label: 'Privacy Policy' },
  { icon: '📞', label: 'Contact Us' },
];

const DANGER_ROWS: Row[] = [
  { icon: '🚪', label: 'Log Out', danger: true },
  { icon: '🗑️', label: 'Delete Account', danger: true },
];

export default function SettingsScreen() {
  const [pushNotifications, setPushNotifications] = useState(true);
  const [biometricLogin, setBiometricLogin] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Red header */}
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.titleIconBox}>
              <Text style={styles.titleIcon}>⚙️</Text>
            </View>
            <Text style={styles.title}>Settings</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View>
              <View style={styles.avatar}>
                <Text style={styles.avatarIcon}>👤</Text>
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarBadgeIcon}>🏠</Text>
                </View>
              </View>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{PROFILE.name}</Text>
              <Text style={styles.profileDetail}>{PROFILE.email}</Text>
              <Text style={styles.profileDetail}>{PROFILE.phone}</Text>
            </View>
            <Pressable style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
              <Text style={styles.editIcon}>✏️</Text>
            </Pressable>
          </View>
        </View>

        {/* Account rows */}
        <View style={styles.card}>
          {NAV_ROWS.map((row, index) => (
            <Pressable key={row.label} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.rowIconBox}>
                <Text style={styles.rowIcon}>{row.icon}</Text>
              </View>
              <Text style={styles.rowLabel}>{row.label}</Text>
              {row.value != null && <Text style={styles.rowValue}>{row.value}</Text>}
              {index < NAV_ROWS.length && <Text style={styles.chevron}>›</Text>}
            </Pressable>
          ))}
        </View>

        {/* Preference toggles */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIconBox}>
              <Text style={styles.rowIcon}>🔔</Text>
            </View>
            <Text style={styles.rowLabel}>Push Notifications</Text>
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: '#E4E4E9', true: RED }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={styles.row}>
            <View style={styles.rowIconBox}>
              <Text style={styles.rowIcon}>👆</Text>
            </View>
            <Text style={styles.rowLabel}>Biometric Login</Text>
            <Switch
              value={biometricLogin}
              onValueChange={setBiometricLogin}
              trackColor={{ false: '#E4E4E9', true: RED }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Support links */}
        <View style={styles.card}>
          {LINK_ROWS.map((row) => (
            <Pressable key={row.label} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.rowIconBox}>
                <Text style={styles.rowIcon}>{row.icon}</Text>
              </View>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>

        {/* Danger zone */}
        <View style={styles.card}>
          {DANGER_ROWS.map((row) => (
            <Pressable key={row.label} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.rowIconBox}>
                <Text style={styles.rowIcon}>{row.icon}</Text>
              </View>
              <Text style={[styles.rowLabel, styles.dangerLabel]}>{row.label}</Text>
              <Text style={[styles.chevron, styles.dangerLabel]}>›</Text>
            </Pressable>
          ))}
        </View>

        {/* Footer */}
        <Text style={styles.footerVersion}>Jalikud v2.4.1</Text>
        <Text style={styles.footerCopyright}>© 2026 Jalikud Food Corp, Davao City.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  headerSafe: {
    backgroundColor: RED,
  },
  header: {
    backgroundColor: RED,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleIcon: {
    fontSize: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: BottomTabInset + 24,
  },
  pressed: {
    opacity: 0.7,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 16,
    backgroundColor: ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    fontSize: 30,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: CARD,
  },
  avatarBadgeIcon: {
    fontSize: 10,
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  profileDetail: {
    fontSize: 12,
    color: TEXT_GRAY,
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 17,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIcon: {
    fontSize: 16,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  rowValue: {
    fontSize: 13,
    color: TEXT_GRAY,
  },
  chevron: {
    fontSize: 20,
    lineHeight: 22,
    color: '#C7C7CC',
  },
  dangerLabel: {
    color: RED,
  },
  footerVersion: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_DARK,
    marginTop: 12,
  },
  footerCopyright: {
    textAlign: 'center',
    fontSize: 11,
    color: TEXT_GRAY,
    marginTop: 4,
  },
});

