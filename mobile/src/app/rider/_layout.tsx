import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import RiderTabs from '@/components/rider-tabs';

const RED = '#DC2626';

export default function RiderLayout() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.inner}>
        <RiderTabs />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: RED },
  inner: { flex: 1, backgroundColor: '#F4F4F6' },
});