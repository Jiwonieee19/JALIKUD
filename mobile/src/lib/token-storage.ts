import * as SecureStore from 'expo-secure-store';

export const AUTH_TOKEN_KEY = 'jalikud.auth-token';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function assertSecureStoreAvailable(): Promise<void> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure credential storage is unavailable on this device.');
  }
}

export async function getToken(): Promise<string | null> {
  await assertSecureStoreAvailable();
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY, SECURE_STORE_OPTIONS);
}

export async function setToken(token: string): Promise<void> {
  await assertSecureStoreAvailable();
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token, SECURE_STORE_OPTIONS);
}

export async function clearToken(): Promise<void> {
  await assertSecureStoreAvailable();
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY, SECURE_STORE_OPTIONS);
}