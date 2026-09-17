import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEMO_CREDENTIALS, useAuthDemo } from '@/context/auth-demo-context';

const RED = '#DC2626';
const BG = '#F4F4F6';
const INPUT_BG = '#FFFFFF';
const INPUT_BORDER = '#E4E4E9';
const PLACEHOLDER = '#B3B3BA';
const TEXT_DARK = '#1C1C1E';

const DEMO_ACCOUNTS = [
  {
    role: 'Customer' as const,
    icon: '🛍️',
    email: DEMO_CREDENTIALS.customerEmail,
    subtitle: 'Browse menu, cart and orders',
  },
  {
    role: 'Staff' as const,
    icon: '🏪',
    email: DEMO_CREDENTIALS.staffEmail,
    subtitle: 'Manage orders and menu availability',
  },
  {
    role: 'Delivery Rider' as const,
    icon: '🛵',
    email: DEMO_CREDENTIALS.riderEmail,
    subtitle: 'Deliver orders to customers',
  },
];

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuthDemo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = () => {
    const result = signIn(email, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError('');
    setPassword('');
    // Route by the signed-in account's role.
    const normalized = email.trim().toLowerCase();
    if (normalized === DEMO_CREDENTIALS.staffEmail) {
      router.replace('/staff/orders');
      return;
    }
    if (normalized === DEMO_CREDENTIALS.riderEmail) {
      router.replace('/rider/deliveries');
      return;
    }
    router.replace('/(tabs)/menu');
  };

  const fillDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_CREDENTIALS.password);
    setError('');
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Sign in' }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* Settings gear, top-right */}
          <View style={styles.topBar}>
            <Pressable style={({ pressed }) => [styles.gearButton, pressed && styles.pressed]}>
              <Text style={styles.gearIcon}>⚙</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            {/* Brand */}
            <View style={styles.logoCircle}>
              <Text style={styles.logoLetter}>J</Text>
            </View>
            <Text style={styles.brandName}>Jalikud</Text>
            <Text style={styles.brandTagline}>Customer, Store Staff &amp; Rider</Text>

            {/* Form */}
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  setError('');
                }}
              />

              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Password"
                  placeholderTextColor={PLACEHOLDER}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    setError('');
                  }}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.showButton}>
                  <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>

              {error !== '' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠ {error}</Text>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
                onPress={handleSignIn}>
                <Text style={styles.submitText}>Sign In</Text>
              </Pressable>

              {/* Temporary prototype accounts — tap to autofill */}
              <View style={styles.demoCard}>
                <View style={styles.demoHeader}>
                  <Text style={styles.demoTitle}>Demo accounts</Text>
                  <Text style={styles.demoHint}>Tap to autofill · password: {DEMO_CREDENTIALS.password}</Text>
                </View>
                {DEMO_ACCOUNTS.map((account) => (
                  <Pressable
                    key={account.email}
                    accessibilityRole="button"
                    accessibilityLabel={`Fill ${account.role} demo account`}
                    style={({ pressed }) => [styles.demoRow, pressed && styles.pressed]}
                    onPress={() => fillDemoAccount(account.email)}>
                    <Text style={styles.demoIcon}>{account.icon}</Text>
                    <View style={styles.demoCopy}>
                      <Text style={styles.demoRole}>{account.role}</Text>
                      <Text style={styles.demoEmail}>{account.email}</Text>
                      <Text style={styles.demoSubtitle}>{account.subtitle}</Text>
                    </View>
                    <Text style={styles.demoChevron}>›</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Preview staff workspace demo"
                style={({ pressed }) => [styles.staffButton, pressed && styles.pressed]}
                onPress={() => router.push('/staff/orders')}>
                <Text style={styles.staffButtonIcon}>🏪</Text>
                <View style={styles.staffButtonCopy}>
                  <Text style={styles.staffButtonTitle}>Preview Staff Workspace</Text>
                  <Text style={styles.staffButtonSubtitle}>Manage orders and menu availability</Text>
                </View>
                <Text style={styles.staffButtonChevron}>›</Text>
              </Pressable>

              <Link href="/register" style={styles.registerLink}>
                <Text style={styles.registerText}>No account yet? Register</Text>
              </Link>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  gearButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E9E9EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: {
    fontSize: 22,
    color: '#8E8E93',
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  logoLetter: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brandName: {
    marginTop: 16,
    fontSize: 30,
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  brandTagline: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B6B72',
    textAlign: 'center',
  },
  form: {
    marginTop: 32,
    gap: 14,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TEXT_DARK,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 12,
    paddingRight: 14,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TEXT_DARK,
  },
  showButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  showText: {
    fontSize: 14,
    fontWeight: '700',
    color: RED,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B91C1C',
  },
  submitButton: {
    marginTop: 10,
    backgroundColor: RED,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  demoCard: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#D8D8DE',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
  },
  demoHeader: {
    gap: 2,
  },
  demoTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  demoHint: {
    fontSize: 11,
    color: '#8E8E93',
  },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E4E4E9',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FAFAFB',
  },
  demoIcon: {
    fontSize: 22,
  },
  demoCopy: {
    flex: 1,
    gap: 1,
  },
  demoRole: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  demoEmail: {
    fontSize: 12,
    fontWeight: '600',
    color: RED,
  },
  demoSubtitle: {
    fontSize: 11,
    color: '#8E8E93',
  },
  demoChevron: {
    fontSize: 22,
    lineHeight: 24,
    color: '#C7C7CC',
  },
  staffButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#F2B8B8',
    borderRadius: 12,
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  staffButtonIcon: { fontSize: 22 },
  staffButtonCopy: { flex: 1, gap: 2 },
  staffButtonTitle: { fontSize: 14, fontWeight: '800', color: RED },
  staffButtonSubtitle: { fontSize: 11, color: '#8E5A5A' },
  staffButtonChevron: { fontSize: 24, color: RED },
  registerLink: {
    alignSelf: 'center',
    marginTop: 8,
  },
  registerText: {
    fontSize: 14,
    fontWeight: '700',
    color: RED,
  },
});
