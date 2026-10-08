import CustomerTabs from '@/components/customer-tabs';
import ChatWidget from '@/components/chat-widget';
import { View } from 'react-native';

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <CustomerTabs />
      <ChatWidget />
    </View>
  );
}
