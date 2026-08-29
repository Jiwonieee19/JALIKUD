import { NativeTabs } from 'expo-router/unstable-native-tabs';

const RED = '#DC2626';
const GRAY = '#8E8E93';

const TABS = [
  {
    name: 'index',
    label: 'Menu',
    icon: require('@/assets/images/tabIcons/menu.png'),
    activeIcon: require('@/assets/images/tabIcons/menu-active.png'),
  },
  {
    name: 'deals',
    label: 'Deals',
    icon: require('@/assets/images/tabIcons/deals.png'),
    activeIcon: require('@/assets/images/tabIcons/deals-active.png'),
  },
  {
    name: 'rewards',
    label: 'Rewards',
    icon: require('@/assets/images/tabIcons/rewards.png'),
    activeIcon: require('@/assets/images/tabIcons/rewards-active.png'),
  },
  {
    name: 'cart',
    label: 'Cart',
    icon: require('@/assets/images/tabIcons/cart.png'),
    activeIcon: require('@/assets/images/tabIcons/cart-active.png'),
  },
  {
    name: 'orders',
    label: 'Orders',
    icon: require('@/assets/images/tabIcons/orders.png'),
    activeIcon: require('@/assets/images/tabIcons/orders-active.png'),
  },
  {
    name: 'settings',
    label: 'Settings',
    icon: require('@/assets/images/tabIcons/more.png'),
    activeIcon: require('@/assets/images/tabIcons/more-active.png'),
  },
] as const;

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor="#FFFFFF"
      indicatorColor="#F4F4F6"
      labelStyle={{
        default: { color: GRAY, fontWeight: '600' },
        selected: { color: RED },
      }}
      rippleColor="rgba(0, 0, 0, 0.08)">
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon src={{ default: tab.icon, selected: tab.activeIcon }} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

