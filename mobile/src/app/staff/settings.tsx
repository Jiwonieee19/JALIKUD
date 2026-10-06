import { RoleSettingsScreen } from '@/components/role-settings-screen';

export default function StaffSettingsScreen() {
  return (
    <RoleSettingsScreen
      roleLabel="Store Staff"
      roleIcon="🏪"
      details={[{ label: 'Assigned branch', value: 'SM Lanang Premier · JAL-01' }]}
    />
  );
}