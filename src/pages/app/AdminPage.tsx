import { AdminDashboard } from '../AdminDashboard';

export function AdminPage({ visible }: { visible: boolean }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-navy-950">Admin dashboard</h2>
      <AdminDashboard visible={visible} />
    </div>
  );
}
