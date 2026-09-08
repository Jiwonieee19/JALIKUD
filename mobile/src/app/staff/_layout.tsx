import StaffTabs from '@/components/staff-tabs';
import { StaffDemoProvider } from '@/context/staff-demo-context';

export default function StaffLayout() {
  return (
    <StaffDemoProvider>
      <StaffTabs />
    </StaffDemoProvider>
  );
}