import { NativeTabs } from 'expo-router/unstable-native-tabs';

const RIDER_TABS = [
  { name: 'deliveries', label: 'Deliveries', icon: require('@/assets/images/tabIcons/orders.png') },
  { name: 'history', label: 'History', icon: require('@/assets/images/tabIcons/activity.png') },
  { name: 'settings', label: 'Settings', icon: require('@/assets/images/tabIcons/more.png') },
] as const;

export default function RiderTabs() {
  return (
    <NativeTabs
      backgroundColor="#FFFFFF"
      iconColor={{ default: '#8E8E93', selected: '#DC2626' }}
      labelStyle={{ color: '#6B6B72', fontWeight: '600' }}
      indicatorColor="rgba(220, 38, 38, 0.12)"
      rippleColor="rgba(220, 38, 38, 0.12)">
      {RIDER_TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon src={tab.icon} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}