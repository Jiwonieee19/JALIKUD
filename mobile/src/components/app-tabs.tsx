import { NativeTabs } from 'expo-router/unstable-native-tabs';

const WHITE = '#f7f1f1';

const TABS = [
  { name: 'index', label: 'Menu', icon: require('@/assets/images/tabIcons/menu.png') },
  { name: 'deals', label: 'Deals', icon: require('@/assets/images/tabIcons/deals.png') },
  { name: 'rewards', label: 'Rewards', icon: require('@/assets/images/tabIcons/rewards.png') },
  { name: 'cart', label: 'Cart', icon: require('@/assets/images/tabIcons/cart.png') },
  { name: 'orders', label: 'Orders', icon: require('@/assets/images/tabIcons/orders.png') },
  { name: 'more', label: 'More', icon: require('@/assets/images/tabIcons/more.png') },
] as const;

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={WHITE}
      indicatorColor="rgba(255, 255, 255, 0.25)"
      labelStyle={{ color: '#FFFFFF', fontWeight: '600' }}
      rippleColor="rgba(255, 255, 255, 0.2)">
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon src={tab.icon} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

