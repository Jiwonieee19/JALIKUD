import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import RiderTabs from '@/components/rider-tabs';
import { useAuthDemo } from '@/context/auth-demo-context';
import { useDeliveryDemo } from '@/context/delivery-demo-context';

const RED = '#DC2626';

export default function RiderLayout() {
  const { signOut } = useAuthDemo();
  const { riders, setRiderAvailability } = useDeliveryDemo();
  const router = useRouter();
  const rider = riders[0];
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleExitDemo = () => {
    signOut();
    timeoutRef.current = setTimeout(() => router.replace('/login'), 50);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.inner}>
        <RiderTabs />
      </View>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out and exit rider demo"
          onPress={handleExitDemo}
          style={({ pressed }) => [styles.exitButton, pressed && styles.exitPressed]}>
          <Text style={styles.exitText}>Exit</Text>
        </Pressable>
        <Switch
          accessibilityLabel="Toggle rider availability"
          value={rider.status !== 'offline'}
          onValueChange={(value) => setRiderAvailability(rider.id, value ? 'available' : 'offline')}
          trackColor={{ false: '#D9D9DE', true: '#16A34A' }}
          thumbColor="#FFFFFF"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RED },
  inner: { flex: 1, backgroundColor: '#F4F4F6' },
  overlay: { position: 'absolute', top: 8, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  exitButton: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.22)' },
  exitText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  exitPressed: { opacity: 0.7 },
});