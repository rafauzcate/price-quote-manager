import { useEffect, useMemo, useState } from 'react';
import {
  adminApiGetAnalytics,
  adminApiGetOrganizations,
  adminApiGetUsers,
  adminApiGrantAccess,
  adminApiRevokeAccess,
  adminApiUpdateSubscription,
  PLAN_CONFIGS,
  type PlanType,
} from '../lib/subscription';

interface AdminDashboardProps {
  visible: boolean;
}

export function AdminDashboard({ visible }: AdminDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [query, setQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [usersResult, orgsResult, analyticsResult] = await Promise.all([
        adminApiGetUsers(),
        adminApiGetOrganizations(),
        adminApiGetAnalytics(),
      ]);

      setUsers(usersResult.users || []);
      setOrganizations(orgsResult.organizations || []);
      setAnalytics(analyticsResult || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return users;
    const lower = query.toLowerCase();
    return users.filter((user) => {
      const source = `${user.name ?? ''} ${user.company ?? ''} ${user.id ?? ''} ${user.subscription_status ?? ''}`.toLowerCase();
      return source.includes(lower);
    });
  }, [users, query]);

  const handleGrantAccess = async (userId: string) => {
    try {
      await adminApiGrantAccess({ user_id: userId, plan_type: 'individual', days: 30 });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grant access failed');
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    try {
      await adminApiRevokeAccess({ user_id: userId });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke access failed');
    }
  };

  const handleUpdateSubscription = async (userId: string, planType: PlanType) => {
    try {
      await adminApiUpdateSubscription({ user_id: userId, plan_type: planType, status: 'active' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update subscription failed');
    }
  };

  if (!visible) return null;

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Monthly Revenue (GBP)</p>
          <p className="text-2xl font-bold text-gray-900">£{analytics?.revenue_monthly_gbp ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Active Subscriptions</p>
          <p className="text-2xl font-bold text-gray-900">{analytics?.active_subscriptions ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Users</p>
          <p className="text-2xl font-bold text-gray-900">{analytics?.total_users ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Organizations</p>
          <p className="text-2xl font-bold text-gray-900">{analytics?.total_organizations ?? 0}</p>
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Revenue breakdown by plan</h3>
        <div className="space-y-3">
          {PLAN_CONFIGS.map((plan) => {
            const count = analytics?.plan_breakdown?.[plan.id] ?? 0;
            const widthPercent = analytics?.active_subscriptions
              ? Math.round((count / analytics.active_subscriptions) * 100)
              : 0;
            return (
              <div key={plan.id}>
                <div className="flex justify-between text-sm text-gray-700 mb-1">
                  <span>{plan.name}</span>
                  <span>{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${widthPercent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users..."
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full max-w-xs"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">User</th>
                <th className="py-2">Company</th>
                <th className="py-2">Status</th>
                <th className="py-2">Plan</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b align-top">
                  <td className="py-2 pr-2">
                    <div className="font-medium text-gray-900">{user.name || 'Unnamed user'}</div>
                    <div className="text-xs text-gray-500">{user.id}</div>
                  </td>
                  <td className="py-2">{user.company || '-'}</td>
                  <td className="py-2">{user.subscription_status || '-'}</td>
                  <td className="py-2">{user.subscription?.plan_type || '-'}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleGrantAccess(user.id)}
                        className="px-2 py-1 rounded bg-emerald-100 text-emerald-700"
                      >
                        Grant
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokeAccess(user.id)}
                        className="px-2 py-1 rounded bg-red-100 text-red-700"
                      >
                        Revoke
                      </button>
                      <select
                        defaultValue=""
                        onChange={(e) => e.target.value && handleUpdateSubscription(user.id, e.target.value as PlanType)}
                        className="px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="">Set plan...</option>
                        {PLAN_CONFIGS.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="text-sm text-gray-500 mt-4">Loading...</p>}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Organization Management</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Name</th>
                <th className="py-2">Plan</th>
                <th className="py-2">Owner</th>
                <th className="py-2">Members</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.id} className="border-b">
                  <td className="py-2">{org.name}</td>
                  <td className="py-2">{org.plan_type}</td>
                  <td className="py-2 text-xs text-gray-600">{org.owner_id}</td>
                  <td className="py-2">{org.member_count}</td>
                  <td className="py-2">{new Date(org.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
