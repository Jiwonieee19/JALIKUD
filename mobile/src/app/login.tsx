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

// Display-only login screen (no authentication logic).
export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);

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
            <Text style={styles.brandTagline}>Customer &amp; Store Staff</Text>

            {/* Form */}
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Password"
                  placeholderTextColor={PLACEHOLDER}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.showButton}>
                  <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>

              <Pressable style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
                <Text style={styles.submitText}>Sign In</Text>
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
