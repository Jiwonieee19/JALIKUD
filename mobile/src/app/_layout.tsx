import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { SplashOverlay } from '@/components/splash-overlay';
import { AuthDemoProvider } from '@/context/auth-demo-context';
import { DeliveryDemoProvider } from '@/context/delivery-demo-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthDemoProvider>
        <DeliveryDemoProvider>
          <SplashOverlay />
          <Stack screenOptions={{ headerShown: false }} initialRouteName="login">
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="staff" />
            <Stack.Screen name="rider" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
          </Stack>
        </DeliveryDemoProvider>
      </AuthDemoProvider>
    </ThemeProvider>
  );
}
