import { useEffect, useMemo, useState } from 'react';
import { manageOrganization, type SubscriptionStatusResponse } from '../lib/subscription';

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
      if (result.organization?.id) {
        await loadMembers(result.organization.id);
      }
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Organization Settings</h2>
        <p className="text-gray-600">Organization management is available for organization subscription plans.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}
      {message && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-3 text-sm">{message}</div>}

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Organization Profile</h2>
        {organization?.id ? (
          <p className="text-sm text-gray-700">
            Organization ID: <span className="font-mono">{organization.id}</span>
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organization name"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full max-w-md"
            />
            <button
              type="button"
              onClick={handleCreateOrganization}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              Create Organization
            </button>
          </div>
        )}
      </div>

      {organization?.id && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Invite Team Members</h3>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'member' | 'admin')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="button"
                onClick={handleInvite}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                Send Invite
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Team Members</h3>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.user_id} className="border border-gray-100 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.user_id}</p>
                    <p className="text-xs text-gray-500">Role: {member.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {members.length === 0 && <p className="text-sm text-gray-500">No members yet.</p>}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Pending Invites</h3>
            <div className="space-y-2">
              {invites.map((invite) => (
                <div key={invite.id} className="border border-gray-100 rounded-lg p-3">
                  <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                  <p className="text-xs text-gray-500">
                    {invite.role} • {invite.status} • expires {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {invites.length === 0 && <p className="text-sm text-gray-500">No pending invites.</p>}
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscription Details</h3>
        <p className="text-sm text-gray-700">Current plan: {subscriptionStatus?.subscription?.plan_type || 'N/A'}</p>
        <p className="text-sm text-gray-700">
          Next billing date:{' '}
          {subscriptionStatus?.subscription?.current_period_end
            ? new Date(subscriptionStatus.subscription.current_period_end).toLocaleDateString()
            : 'N/A'}
        </p>
      </div>
    </div>
  );
}
