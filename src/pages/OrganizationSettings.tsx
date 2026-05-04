import { useEffect, useMemo, useState } from 'react';
import { manageOrganization, type SubscriptionStatusResponse } from '../lib/subscription';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface OrganizationSettingsProps {
  subscriptionStatus: SubscriptionStatusResponse | null;
}

export function OrganizationSettings({ subscriptionStatus }: OrganizationSettingsProps) {
  const [organization, setOrganization] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const organizationId = subscriptionStatus?.profile.organization_id;

  const canManageOrg = useMemo(
    () => !!subscriptionStatus?.permissions.can_manage_organization || !!organizationId,
    [subscriptionStatus, organizationId],
  );

  const loadMembers = async (orgId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await manageOrganization('list_members', { organization_id: orgId });
      setMembers(result.members || []);
      setInvites(result.invites || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      setOrganization({ id: organizationId });
      loadMembers(organizationId);
    }
  }, [organizationId]);

  const handleCreateOrganization = async () => {
    setError(null);
    setMessage(null);

    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }

    setLoading(true);
    try {
      const result = await manageOrganization('create_organization', { name });
      setOrganization(result.organization);
      setMessage('Organization created successfully.');
      setName('');
      if (result.organization?.id) await loadMembers(result.organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!organization?.id || !email.trim()) {
      setError('Organization and email are required');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await manageOrganization('invite_member', {
        organization_id: organization.id,
        email,
        role,
      });
      setMessage('Invitation sent.');
      setEmail('');
      await loadMembers(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!organization?.id) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await manageOrganization('remove_member', {
        organization_id: organization.id,
        user_id: userId,
      });
      setMessage('Member removed.');
      await loadMembers(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  if (!canManageOrg) {
    return (
      <Card>
        <CardBody>
          <h2 className="text-xl font-semibold text-navy-950">Organization Settings</h2>
          <p className="mt-2 text-sm text-slatePremium-600">Organization management is available on organization subscription plans.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      <Card>
        <CardHeader><h2 className="font-semibold text-navy-950">Organization Profile</h2></CardHeader>
        <CardBody>
          {organization?.id ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Organization name" defaultValue={subscriptionStatus?.subscription?.plan_type?.toUpperCase() || 'Vantage Organization'} />
              <Input label="Organization logo URL" placeholder="https://images-platform.99static.com//b5tJxitdv5ja3CjJ-9xncI7i8V0=/1002x1006:3151x3155/fit-in/590x590/projects-files/36/3698/369814/cd73592b-fbe6-46f0-b836-ecc852e09ca3.jpg" />
              <p className="text-xs text-slatePremium-500 md:col-span-2">Organization ID: <span className="font-mono">{organization.id}</span></p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Input label="Organization Name" value={name} onChange={(e) => setName(e.target.value)} className="md:max-w-md" />
              <Button type="button" onClick={handleCreateOrganization} disabled={loading}>Create Organization</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {organization?.id && (
        <>
          <Card>
            <CardHeader><h3 className="font-semibold text-navy-950">Invite Team Members</h3></CardHeader>
            <CardBody>
              <div className="grid gap-3 md:grid-cols-4">
                <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="md:col-span-2" />
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-slatePremium-700">Role</span>
                  <select value={role} onChange={(e) => setRole(e.target.value as 'member' | 'admin')} className="w-full rounded-xl border border-slatePremium-300 px-3 py-2.5">
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <div className="flex items-end"><Button type="button" onClick={handleInvite} disabled={loading} className="w-full">Send Invite</Button></div>
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader><h3 className="font-semibold text-navy-950">Team Members</h3></CardHeader>
              <CardBody className="space-y-2">
                {members.map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between rounded-xl border border-slatePremium-200 p-3">
                    <div>
                      <p className="font-medium text-slatePremium-900">{member.user_id}</p>
                      <p className="text-xs text-slatePremium-500">Role: {member.role}</p>
                    </div>
                    <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => handleRemoveMember(member.user_id)}>Remove</Button>
                  </div>
                ))}
                {members.length === 0 && <p className="text-sm text-slatePremium-500">No members yet.</p>}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className="font-semibold text-navy-950">Pending Invites</h3></CardHeader>
              <CardBody className="space-y-2">
                {invites.map((invite) => (
                  <div key={invite.id} className="rounded-xl border border-slatePremium-200 p-3">
                    <p className="font-medium text-slatePremium-900">{invite.email}</p>
                    <p className="text-xs text-slatePremium-500">{invite.role} • {invite.status} • expires {new Date(invite.expires_at).toLocaleDateString()}</p>
                  </div>
                ))}
                {invites.length === 0 && <p className="text-sm text-slatePremium-500">No pending invites.</p>}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader><h3 className="font-semibold text-navy-950">Subscription Details</h3></CardHeader>
        <CardBody className="space-y-1 text-sm text-slatePremium-700">
          <p>Current plan: <span className="font-semibold">{subscriptionStatus?.subscription?.plan_type || 'N/A'}</span></p>
          <p>Subscription status: <span className="font-semibold">{subscriptionStatus?.profile.subscription_status || 'N/A'}</span></p>
          <p>Trial days remaining: <span className="font-semibold">{subscriptionStatus?.trial_days_remaining ?? 0}</span></p>
        </CardBody>
      </Card>
    </div>
  );
}
