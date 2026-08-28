import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RED = '#DC2626';
const BG = '#F4F4F6';
const INPUT_BG = '#FFFFFF';
const INPUT_BORDER = '#E4E4E9';
const PLACEHOLDER = '#B3B3BA';
const TEXT_DARK = '#1C1C1E';

// Display-only registration screen (no logic or validation).
export default function RegisterScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <Stack.Screen options={{ title: 'Register' }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            {/* Brand */}
            <View style={styles.logoCircle}>
              <Text style={styles.logoLetter}>J</Text>
            </View>
            <Text style={styles.brandName}>Jalikud</Text>
            <Text style={styles.brandTagline}>Customer &amp; Store Staff</Text>

            {/* Form */}
            <View style={styles.form}>
              <Text style={styles.heading}>Create account</Text>

              <Text style={styles.label}>First name</Text>
              <TextInput
                style={styles.input}
                placeholder="Juan"
                placeholderTextColor={PLACEHOLDER}
                autoComplete="given-name"
              />

              <Text style={styles.label}>Last name</Text>
              <TextInput
                style={styles.input}
                placeholder="Dela Cruz"
                placeholderTextColor={PLACEHOLDER}
                autoComplete="family-name"
              />

              <Text style={styles.label}>Address</Text>
              <TextInput
                style={[styles.input, styles.addressInput]}
                placeholder="123 Main St, City"
                placeholderTextColor={PLACEHOLDER}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={styles.input}
                placeholder="+63 900 000 0000"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="phone-pad"
                autoComplete="tel"
              />

              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor={PLACEHOLDER}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.showButton}>
                  <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Confirm password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor={PLACEHOLDER}
                  secureTextEntry={!showConfirm}
                  autoComplete="new-password"
                />
                <Pressable
                  onPress={() => setShowConfirm((v) => !v)}
                  style={styles.showButton}>
                  <Text style={styles.showText}>{showConfirm ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>

              <Pressable style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
                <Text style={styles.submitText}>Register</Text>
              </Pressable>

              <Link href="/login" style={styles.loginLink}>
                <Text style={styles.loginText}>Already have an account? Login</Text>
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
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  logoLetter: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brandName: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  brandTagline: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B6B72',
    textAlign: 'center',
  },
  form: {
    marginTop: 28,
    gap: 10,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B72',
    marginTop: 4,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: TEXT_DARK,
  },
  addressInput: {
    minHeight: 80,
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
    paddingVertical: 13,
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
  submitButton: {
    marginTop: 16,
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
  loginLink: {
    alignSelf: 'center',
    marginTop: 8,
  },
  loginText: {
    fontSize: 14,
    fontWeight: '700',
    color: RED,
  },
  pressed: {
    opacity: 0.7,
  },
});
