import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  PLAN_CONFIGS,
  adminApiCreateUser,
  adminApiDeleteUser,
  adminApiGetAnalytics,
  adminApiGetOrganizations,
  adminApiGetUsers,
  adminApiUpdateUser,
  type PlanType,
} from '../lib/subscription';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

interface AdminDashboardProps {
  visible: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  subscription_status: string | null;
  is_superadmin: boolean;
  subscription?: {
    plan_type?: PlanType;
    status?: string;
  } | null;
}

interface AddUserFormState {
  email: string;
  name: string;
  company: string;
  plan_type: PlanType;
  subscription_status: string;
  send_invitation_email: boolean;
}

interface EditUserFormState {
  name: string;
  company: string;
  plan_type: PlanType;
  subscription_status: string;
}

interface AdminAnalytics {
  revenue_monthly_gbp?: number;
  revenue_growth_percentage?: number;
  total_users?: number;
  total_organizations?: number;
  active_subscriptions?: number;
  plan_breakdown?: Partial<Record<PlanType, number>>;
}

interface AdminOrganization {
  id: string;
  name: string;
  plan_type: string;
  owner_id: string;
  member_count: number;
  created_at: string;
}

const SUBSCRIPTION_STATUS_OPTIONS = ['trialing', 'active', 'past_due', 'canceled', 'expired'] as const;

const DEFAULT_ADD_FORM: AddUserFormState = {
  email: '',
  name: '',
  company: '',
  plan_type: 'individual',
  subscription_status: 'trialing',
  send_invitation_email: true,
};

export function AdminDashboard({ visible }: AdminDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [query, setQuery] = useState('');

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState<AddUserFormState>(DEFAULT_ADD_FORM);

  const [userBeingEdited, setUserBeingEdited] = useState<AdminUser | null>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserFormState>({
    name: '',
    company: '',
    plan_type: 'individual',
    subscription_status: 'trialing',
  });

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
      const message = err instanceof Error ? err.message : 'Failed to load admin data';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      void loadData();
    }
  }, [visible]);

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return users;
    const lower = query.toLowerCase();
    return users.filter((user) => {
      const source = `${user.name ?? ''} ${user.company ?? ''} ${user.email ?? ''} ${user.subscription_status ?? ''} ${user.subscription?.plan_type ?? ''}`.toLowerCase();
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

  const handleOpenEditModal = (user: AdminUser) => {
    setUserBeingEdited(user);
    setEditUserForm({
      name: user.name || '',
      company: user.company || '',
      plan_type: user.subscription?.plan_type || 'individual',
      subscription_status: user.subscription_status || 'trialing',
    });
  };

  const handleAddUser = async () => {
    if (!addUserForm.email.trim()) {
      toast.error('Email is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await adminApiCreateUser({
        email: addUserForm.email,
        name: addUserForm.name,
        company: addUserForm.company,
        plan_type: addUserForm.plan_type,
        subscription_status: addUserForm.subscription_status,
        send_invitation_email: addUserForm.send_invitation_email,
      });

      toast.success('User created successfully');
      setIsAddUserModalOpen(false);
      setAddUserForm(DEFAULT_ADD_FORM);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create user';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!userBeingEdited) return;

    setSaving(true);
    setError(null);

    try {
      await adminApiUpdateUser(userBeingEdited.id, {
        name: editUserForm.name,
        company: editUserForm.company,
        plan_type: editUserForm.plan_type,
        subscription_status: editUserForm.subscription_status,
      });

      toast.success('User updated successfully');
      setUserBeingEdited(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (user.is_superadmin) {
      toast.error('Protected superadmin accounts cannot be deleted');
      return;
    }

    const confirmed = window.confirm(`Delete user ${user.email}? This action removes profile data and related access records.`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      await adminApiDeleteUser(user.id, { hard_delete: false });
      toast.success('User deleted successfully');
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete user';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardBody>
            <p className="text-xs text-slatePremium-500">MRR</p>
            <p className="text-2xl font-bold text-navy-950">£{analytics?.revenue_monthly_gbp ?? 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-slatePremium-500">ARR</p>
            <p className="text-2xl font-bold text-navy-950">£{(analytics?.revenue_monthly_gbp ?? 0) * 12}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-slatePremium-500">Growth</p>
            <p className="text-2xl font-bold text-navy-950">{analytics?.revenue_growth_percentage ?? 0}%</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-slatePremium-500">Total Users</p>
            <p className="text-2xl font-bold text-navy-950">{analytics?.total_users ?? 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-slatePremium-500">Organizations</p>
            <p className="text-2xl font-bold text-navy-950">{analytics?.total_organizations ?? 0}</p>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-navy-950">Revenue by plan</h3>
          </CardHeader>
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
          <CardHeader>
            <h3 className="font-semibold text-navy-950">Subscription performance</h3>
          </CardHeader>
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
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold text-navy-950">User management</h3>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users"
              className="w-full rounded-xl border border-slatePremium-300 px-3 py-2 text-sm sm:w-72"
            />
            <Button type="button" leftIcon={<UserPlus size={16} />} onClick={() => setIsAddUserModalOpen(true)}>
              Add user
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slatePremium-500">
                <tr className="border-b border-slatePremium-200">
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Company</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slatePremium-100 align-top">
                    <td className="py-2 pr-2">
                      <div className="font-medium">{user.email || 'No email available'}</div>
                      <div className="text-xs text-slatePremium-500">{user.name || 'Unnamed user'}</div>
                    </td>
                    <td className="py-2">{user.company || '-'}</td>
                    <td className="py-2">{user.subscription_status || '-'}</td>
                    <td className="py-2">{user.subscription?.plan_type || 'individual'}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => handleOpenEditModal(user)}>
                          <Pencil size={12} /> Edit
                        </Button>
                        <Button
                          variant="danger"
                          className="px-2 py-1 text-xs"
                          onClick={() => handleDeleteUser(user)}
                          disabled={saving || user.is_superadmin}
                        >
                          <Trash2 size={12} /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && <p className="mt-4 text-sm text-slatePremium-500">Loading...</p>}
            {!loading && filteredUsers.length === 0 ? <p className="mt-4 text-sm text-slatePremium-500">No users found.</p> : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-navy-950">Organization overview</h3>
        </CardHeader>
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

      <Modal open={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)}>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-navy-950">Add user</h3>
          <Input
            label="Email *"
            type="email"
            value={addUserForm.email}
            onChange={(e) => setAddUserForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="name@company.com"
          />
          <Input
            label="Name"
            value={addUserForm.name}
            onChange={(e) => setAddUserForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Optional display name"
          />
          <Input
            label="Company"
            value={addUserForm.company}
            onChange={(e) => setAddUserForm((prev) => ({ ...prev, company: e.target.value }))}
            placeholder="Optional company"
          />

          <label className="block text-sm font-medium text-slatePremium-700">
            Subscription plan
            <select
              value={addUserForm.plan_type}
              onChange={(e) => setAddUserForm((prev) => ({ ...prev, plan_type: e.target.value as PlanType }))}
              className="mt-1 w-full rounded-xl border border-slatePremium-300 px-3 py-2 text-sm"
            >
              {PLAN_CONFIGS.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slatePremium-700">
            Subscription status
            <select
              value={addUserForm.subscription_status}
              onChange={(e) => setAddUserForm((prev) => ({ ...prev, subscription_status: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slatePremium-300 px-3 py-2 text-sm"
            >
              {SUBSCRIPTION_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-slatePremium-700">
            <input
              type="checkbox"
              checked={addUserForm.send_invitation_email}
              onChange={(e) => setAddUserForm((prev) => ({ ...prev, send_invitation_email: e.target.checked }))}
            />
            Send invitation email
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddUserModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={saving}>
              {saving ? 'Saving...' : 'Create user'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(userBeingEdited)}
        onClose={() => setUserBeingEdited(null)}
        panelClassName="max-w-3xl rounded-3xl"
      >
        <div className="p-6 sm:p-8">
          <div className="mb-6 border-b border-slatePremium-200 pb-4 sm:mb-8 sm:pb-5">
            <h3 className="text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">Edit user</h3>
            <p className="mt-2 text-sm text-slatePremium-600">Update profile, plan, and subscription status.</p>
          </div>

          <div className="space-y-6">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slatePremium-700">Name</span>
              <input
                value={editUserForm.name}
                onChange={(e) => setEditUserForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-xl border border-slatePremium-300 px-4 py-3 text-base text-slatePremium-900 placeholder:text-slatePremium-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                placeholder="Enter user name"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slatePremium-700">Company</span>
              <input
                value={editUserForm.company}
                onChange={(e) => setEditUserForm((prev) => ({ ...prev, company: e.target.value }))}
                className="w-full rounded-xl border border-slatePremium-300 px-4 py-3 text-base text-slatePremium-900 placeholder:text-slatePremium-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                placeholder="Enter company name"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slatePremium-700">Plan</span>
              <select
                value={editUserForm.plan_type}
                onChange={(e) => setEditUserForm((prev) => ({ ...prev, plan_type: e.target.value as PlanType }))}
                className="w-full rounded-xl border border-slatePremium-300 px-4 py-3 text-base text-slatePremium-900 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
              >
                {PLAN_CONFIGS.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slatePremium-700">Subscription status</span>
              <select
                value={editUserForm.subscription_status}
                onChange={(e) => setEditUserForm((prev) => ({ ...prev, subscription_status: e.target.value }))}
                className="w-full rounded-xl border border-slatePremium-300 px-4 py-3 text-base text-slatePremium-900 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
              >
                {SUBSCRIPTION_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setUserBeingEdited(null)}
              disabled={saving}
              className="px-6 py-3 text-base"
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={saving} className="px-6 py-3 text-base">
              {saving ? 'Saving...' : 'Update user'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
