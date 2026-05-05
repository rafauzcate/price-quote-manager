import { PLAN_CONFIGS, type PlanType } from './plans';
import { isPublicRoute } from './routeGuards';

export { PLAN_CONFIGS, type PlanType };

const SUPERADMIN_EMAILS = new Set(['rafael.uzcategui@gmail.com', 'hello@vantageprojectsolution.co.uk']);
const SUBSCRIPTION_STATUS_CACHE_TTL_MS = 10_000;

let subscriptionStatusInFlight: Promise<SubscriptionStatusResponse> | null = null;
let subscriptionStatusCache: { data: SubscriptionStatusResponse; timestamp: number } | null = null;

async function getSupabaseClient() {
  const module = await import('./supabase');
  return module.getSupabaseClient();
}

export function isSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return SUPERADMIN_EMAILS.has(email.trim().toLowerCase());
}

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

function isRetryableError(status?: number, message?: string): boolean {
  if (status === 429 || (status !== undefined && status >= 500)) return true;

  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed') ||
    normalized.includes('err_insufficient_resources') ||
    normalized.includes('insufficient_resources')
  );
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function authedFetch(functionPath: string, init?: RequestInit) {
  if (isPublicRoute()) {
    console.warn('[Subscription] Blocked function call on public route.', {
      functionPath,
      route: window.location.pathname,
      stack: new Error().stack,
    });
    throw new Error('Subscription API unavailable on public routes');
  }

  const supabase = await getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Authentication token not available');
  }

  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${getFunctionBaseUrl()}${functionPath}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          ...(init?.headers || {}),
        },
      });

      const responseText = await response.text();
      let data: any = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        const apiError = new Error(data?.error || `Request failed (${response.status})`);
        if (attempt < maxAttempts && isRetryableError(response.status, apiError.message)) {
          await delay(300 * attempt);
          continue;
        }
        throw apiError;
      }

      return data;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error('Unknown request error');
      lastError = normalizedError;

      if (attempt < maxAttempts && isRetryableError(undefined, normalizedError.message)) {
        await delay(300 * attempt);
        continue;
      }

      throw normalizedError;
    }
  }

  throw lastError || new Error('Request failed after retries');
}

export async function fetchSubscriptionStatus(options?: { force?: boolean }): Promise<SubscriptionStatusResponse> {
  const force = options?.force ?? false;
  const now = Date.now();

  if (!force && subscriptionStatusCache && now - subscriptionStatusCache.timestamp < SUBSCRIPTION_STATUS_CACHE_TTL_MS) {
    return subscriptionStatusCache.data;
  }

  if (!force && subscriptionStatusInFlight) {
    return subscriptionStatusInFlight;
  }

  subscriptionStatusInFlight = (async () => {
    const data = await authedFetch('/check-subscription-status', { method: 'GET' });
    subscriptionStatusCache = { data, timestamp: Date.now() };
    return data;
  })();

  try {
    return await subscriptionStatusInFlight;
  } finally {
    subscriptionStatusInFlight = null;
  }
}

export function clearSubscriptionStatusCache(): void {
  subscriptionStatusCache = null;
  subscriptionStatusInFlight = null;
}

export async function createCheckoutSession(planType: PlanType): Promise<{ checkout_url: string; session_id: string }> {
  const supabase = await getSupabaseClient();
  const result = await supabase.functions.invoke('create-checkout-session', {
    body: {
      plan_type: planType,
    },
  });

  if (result.error) {
    throw new Error(result.error.message || 'Failed to create checkout session');
  }

  clearSubscriptionStatusCache();
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

export async function adminApiCreateUser(payload: {
  email: string;
  company?: string;
  name?: string;
  plan_type: PlanType;
  subscription_status?: string;
  send_invitation_email?: boolean;
}) {
  return authedFetch('/admin-api/users', { method: 'POST', body: JSON.stringify(payload) });
}

export async function adminApiUpdateUser(
  userId: string,
  payload: {
    company?: string;
    name?: string;
    plan_type?: PlanType;
    subscription_status?: string;
  },
) {
  return authedFetch(`/admin-api/users/${encodeURIComponent(userId)}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function adminApiDeleteUser(userId: string, payload?: { hard_delete?: boolean }) {
  return authedFetch(`/admin-api/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    body: JSON.stringify(payload ?? { hard_delete: false }),
  });
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
  const supabase = await getSupabaseClient();
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
