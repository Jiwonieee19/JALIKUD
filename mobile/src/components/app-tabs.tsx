import { Tabs } from 'expo-router';
import { Image, StyleSheet } from 'react-native';

const TAB_BAR_BACKGROUND = '#F7F1F1';

const TABS = [
  { name: 'index', label: 'Menu', icon: require('@/assets/images/tabIcons/menu.png') },
  { name: 'deals', label: 'Deals', icon: require('@/assets/images/tabIcons/deals.png') },
  { name: 'rewards', label: 'Rewards', icon: require('@/assets/images/tabIcons/rewards.png') },
  { name: 'cart', label: 'Cart', icon: require('@/assets/images/tabIcons/cart.png') },
  { name: 'orders', label: 'Orders', icon: require('@/assets/images/tabIcons/orders.png') },
  { name: 'settings', label: 'Settings', icon: require('@/assets/images/tabIcons/settings.png') },
] as const;

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#208AEF',
        tabBarInactiveTintColor: '#5F6368',
        tabBarShowLabel: true,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
      }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarLabel: tab.label,
            tabBarIcon: ({ color }) => (
              <Image source={tab.icon} style={[styles.icon, { tintColor: color }]} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: TAB_BAR_BACKGROUND,
    borderTopColor: '#E1DADA',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  icon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
});

