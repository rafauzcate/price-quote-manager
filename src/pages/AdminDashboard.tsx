import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, CartesianGrid } from 'recharts';
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
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

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
    if (visible) loadData();
  }, [visible]);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return users;
    const lower = query.toLowerCase();
    return users.filter((user) => {
      const source = `${user.name ?? ''} ${user.company ?? ''} ${user.id ?? ''} ${user.subscription_status ?? ''}`.toLowerCase();
      return source.includes(lower);
    });
  }, [users, query]);

  const planBreakdown = PLAN_CONFIGS.map((plan) => ({
    plan: plan.name,
    count: analytics?.plan_breakdown?.[plan.id] ?? 0,
    revenue: (analytics?.plan_breakdown?.[plan.id] ?? 0) * plan.priceGbp,
  }));

  const growthSeries = [
    { label: 'MRR', value: analytics?.revenue_monthly_gbp ?? 0 },
    { label: 'ARR', value: (analytics?.revenue_monthly_gbp ?? 0) * 12 },
    { label: 'Active Subscriptions', value: analytics?.active_subscriptions ?? 0 },
  ];

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
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card><CardBody><p className="text-xs text-slatePremium-500">MRR</p><p className="text-2xl font-bold text-navy-950">£{analytics?.revenue_monthly_gbp ?? 0}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs text-slatePremium-500">ARR</p><p className="text-2xl font-bold text-navy-950">£{(analytics?.revenue_monthly_gbp ?? 0) * 12}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs text-slatePremium-500">Growth</p><p className="text-2xl font-bold text-navy-950">{analytics?.revenue_growth_percentage ?? 0}%</p></CardBody></Card>
        <Card><CardBody><p className="text-xs text-slatePremium-500">Total Users</p><p className="text-2xl font-bold text-navy-950">{analytics?.total_users ?? 0}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs text-slatePremium-500">Organizations</p><p className="text-2xl font-bold text-navy-950">{analytics?.total_organizations ?? 0}</p></CardBody></Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><h3 className="font-semibold text-navy-950">Revenue by plan</h3></CardHeader>
          <CardBody className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="plan" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="#D4AF37" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold text-navy-950">Subscription performance</h3></CardHeader>
          <CardBody className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line dataKey="value" stroke="#1a2332" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-navy-950">User management</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users"
            className="rounded-xl border border-slatePremium-300 px-3 py-2 text-sm w-full max-w-xs"
          />
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slatePremium-500">
                <tr className="border-b border-slatePremium-200">
                  <th className="pb-2">User</th>
                  <th className="pb-2">Company</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slatePremium-100 align-top">
                    <td className="py-2 pr-2"><div className="font-medium">{user.name || 'Unnamed user'}</div><div className="text-xs text-slatePremium-500">{user.id}</div></td>
                    <td className="py-2">{user.company || '-'}</td>
                    <td className="py-2">{user.subscription_status || '-'}</td>
                    <td className="py-2">{user.subscription?.plan_type || '-'}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => handleGrantAccess(user.id)}>Grant</Button>
                        <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => handleRevokeAccess(user.id)}>Revoke</Button>
                        <select
                          defaultValue=""
                          onChange={(e) => e.target.value && handleUpdateSubscription(user.id, e.target.value as PlanType)}
                          className="rounded-lg border border-slatePremium-300 px-2 py-1 text-xs"
                        >
                          <option value="">Set plan...</option>
                          {PLAN_CONFIGS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && <p className="mt-4 text-sm text-slatePremium-500">Loading...</p>}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h3 className="font-semibold text-navy-950">Organization overview</h3></CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slatePremium-500">
                <tr className="border-b border-slatePremium-200">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Owner</th>
                  <th className="pb-2">Members</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.id} className="border-b border-slatePremium-100">
                    <td className="py-2">{org.name}</td>
                    <td className="py-2">{org.plan_type}</td>
                    <td className="py-2 text-xs text-slatePremium-600">{org.owner_id}</td>
                    <td className="py-2">{org.member_count}</td>
                    <td className="py-2">{new Date(org.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
