import { RoleSettingsScreen } from '@/components/role-settings-screen';
import { useDeliveryDemo } from '@/context/delivery-demo-context';

export default function RiderSettingsScreen() {
  const { riders } = useDeliveryDemo();
  const rider = riders[0];
  const status =
    rider.status === 'available'
      ? 'On Duty'
      : rider.status === 'on_delivery'
        ? 'On Delivery'
        : 'Unavailable';

  return (
    <RoleSettingsScreen
      roleLabel="Delivery Rider"
      roleIcon="🛵"
      details={[
        { label: 'Vehicle', value: rider.vehicle },
        { label: 'Duty status', value: status },
      ]}
    />
  );
}