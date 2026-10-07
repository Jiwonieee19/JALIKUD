import { Link, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { routeForRole, useAuth } from '@/context/auth-context';
import { errorMessage, fieldError, isApiError } from '@/lib/api';

const RED = '#DC2626';
const BG = '#F4F4F6';
const INPUT_BG = '#FFFFFF';
const INPUT_BORDER = '#E4E4E9';
const PLACEHOLDER = '#B3B3BA';
const TEXT_DARK = '#1C1C1E';

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

const INITIAL_FORM: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.fieldError}>{message}</Text>;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required.';
    if (!form.lastName.trim()) next.lastName = 'Last name is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!form.phone.trim()) next.phone = 'Phone number is required.';
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters.';
    else if (!/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/\d/.test(form.password)) {
      next.password = 'Use an uppercase letter, lowercase letter, and number.';
    }
    if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      const user = await register({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email: form.email,
        phone: form.phone,
        password: form.password,
        password_confirmation: form.confirmPassword,
      });
      router.replace(routeForRole(user.role));
    } catch (caught) {
      if (isApiError(caught)) {
        setErrors((current) => ({
          ...current,
          email: fieldError(caught, 'email'),
          phone: fieldError(caught, 'phone'),
          password: fieldError(caught, 'password'),
        }));
      }
      setFormError(errorMessage(caught, 'Unable to register. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Register' }} />
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            {/* Brand */}
            <Image
              accessibilityLabel="Jalikud logo"
              contentFit="contain"
              source={require('@/assets/images/jalikud-logo.png')}
              style={styles.logo}
            />
            <Text style={styles.brandName}>Jalikud</Text>
            <Text style={styles.brandTagline}>Customer registration</Text>

            {/* Form */}
            <View style={styles.form}>
              <Text style={styles.heading}>Create account</Text>
              <Text style={styles.note}>New accounts are always created as customers.</Text>

              <Text style={styles.label}>First name</Text>
              <TextInput
                style={[styles.input, errors.firstName && styles.inputError]}
                placeholder="Juan"
                placeholderTextColor={PLACEHOLDER}
                autoComplete="given-name"
                value={form.firstName}
                onChangeText={(value) => updateField('firstName', value)}
              />
              <FieldError message={errors.firstName} />

              <Text style={styles.label}>Last name</Text>
              <TextInput
                style={[styles.input, errors.lastName && styles.inputError]}
                placeholder="Dela Cruz"
                placeholderTextColor={PLACEHOLDER}
                autoComplete="family-name"
                value={form.lastName}
                onChangeText={(value) => updateField('lastName', value)}
              />
              <FieldError message={errors.lastName} />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="you@example.com"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={form.email}
                onChangeText={(value) => updateField('email', value)}
              />
              <FieldError message={errors.email} />

              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={[styles.input, errors.phone && styles.inputError]}
                placeholder="+63 900 000 0000"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="phone-pad"
                autoComplete="tel"
                value={form.phone}
                onChangeText={(value) => updateField('phone', value)}
              />
              <FieldError message={errors.phone} />

              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor={PLACEHOLDER}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  value={form.password}
                  onChangeText={(value) => updateField('password', value)}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.showButton}>
                  <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
              <FieldError message={errors.password} />

              <Text style={styles.label}>Confirm password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor={PLACEHOLDER}
                  secureTextEntry={!showConfirm}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChangeText={(value) => updateField('confirmPassword', value)}
                />
                <Pressable
                  onPress={() => setShowConfirm((v) => !v)}
                  style={styles.showButton}>
                  <Text style={styles.showText}>{showConfirm ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
              <FieldError message={errors.confirmPassword} />

              {formError !== '' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠ {formError}</Text>
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                style={({ pressed }) => [styles.submitButton, (pressed || submitting) && styles.pressed]}
                onPress={() => void handleRegister()}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Register</Text>}
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
  logo: {
    width: 82,
    height: 93,
    alignSelf: 'center',
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
  note: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: -4,
    marginBottom: 4,
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
  inputError: {
    borderColor: '#F87171',
  },
  fieldError: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    marginTop: 2,
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
