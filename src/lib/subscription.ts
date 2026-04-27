import { supabase } from './supabase';

export type PlanType = 'individual' | 'org_5' | 'org_10' | 'org_50';

export interface PlanConfig {
  id: PlanType;
  name: string;
  priceGbp: number;
  seats: number;
  description: string;
  features: string[];
}

export const PLAN_CONFIGS: PlanConfig[] = [
  {
    id: 'individual',
    name: 'Individual',
    priceGbp: 20,
    seats: 1,
    description: 'Perfect for solo procurement specialists',
    features: ['1 user account', 'Unlimited quote parsing', 'AI-assisted extraction', 'Basic support'],
  },
  {
    id: 'org_5',
    name: 'Organization 5',
    priceGbp: 50,
    seats: 5,
    description: 'For small teams with shared workflows',
    features: ['Up to 5 users', 'Shared organization workspace', 'Team invite management', 'Priority support'],
  },
  {
    id: 'org_10',
    name: 'Organization 10',
    priceGbp: 75,
    seats: 10,
    description: 'Growing procurement and commercial teams',
    features: ['Up to 10 users', 'Advanced team access controls', 'Usage transparency', 'Priority support'],
  },
  {
    id: 'org_50',
    name: 'Organization 50',
    priceGbp: 100,
    seats: 50,
    description: 'Enterprise collaboration at scale',
    features: ['Up to 50 users', 'Large-team administration', 'Shared quota across org', 'Priority support'],
  },
];

export interface SubscriptionStatusResponse {
  has_access: boolean;
  access_reason: string;
  is_superadmin: boolean;
  profile: {
    subscription_status: string;
    trial_ends_at: string | null;
    organization_id: string | null;
  };
  subscription: {
    id: string;
    plan_type: PlanType;
    status: string;
    trial_end: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  permissions: {
    can_use_all_features: boolean;
    can_manage_admin_dashboard: boolean;
    can_manage_organization: boolean;
  };
  trial_days_remaining: number;
}

function getFunctionBaseUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1`;
}

async function authedFetch(functionPath: string, init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Authentication token not available');
  }

  const response = await fetch(`${getFunctionBaseUrl()}${functionPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers || {}),
    },
  });

  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data;
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatusResponse> {
  return await authedFetch('/check-subscription-status', { method: 'GET' });
}

export async function createCheckoutSession(planType: PlanType): Promise<{ checkout_url: string; session_id: string }> {
  const result = await supabase.functions.invoke('create-checkout-session', {
    body: {
      plan_type: planType,
    },
  });

  if (result.error) {
    throw new Error(result.error.message || 'Failed to create checkout session');
  }

  return result.data;
}

export async function adminApiGetUsers() {
  return authedFetch('/admin-api/users', { method: 'GET' });
}

export async function adminApiGetOrganizations() {
  return authedFetch('/admin-api/organizations', { method: 'GET' });
}

export async function adminApiGetAnalytics() {
  return authedFetch('/admin-api/analytics', { method: 'GET' });
}

export async function adminApiGrantAccess(payload: { user_id: string; plan_type: PlanType; days?: number }) {
  return authedFetch('/admin-api/grant-access', { method: 'POST', body: JSON.stringify(payload) });
}

export async function adminApiRevokeAccess(payload: { user_id: string }) {
  return authedFetch('/admin-api/revoke-access', { method: 'POST', body: JSON.stringify(payload) });
}

export async function adminApiUpdateSubscription(payload: {
  user_id: string;
  plan_type: PlanType;
  status: string;
  current_period_end?: string;
}) {
  return authedFetch('/admin-api/update-subscription', { method: 'PUT', body: JSON.stringify(payload) });
}

export async function manageOrganization(action: string, payload: Record<string, unknown>) {
  const result = await supabase.functions.invoke('manage-organization', {
    body: { action, payload },
  });

  if (result.error) {
    throw new Error(result.error.message || 'Failed to manage organization');
  }

  if (result.data?.error) {
    throw new Error(result.data.error);
  }

  return result.data;
}
