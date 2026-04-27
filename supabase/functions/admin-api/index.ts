import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  PLAN_DETAILS,
  SUPERADMIN_EMAILS,
  corsHeaders,
  getAuthedClient,
  getServiceClient,
  jsonResponse,
} from "../_shared/subscription-utils.ts";

function getEndpointPath(req: Request): string {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const fnIndex = parts.findIndex((p) => p === "admin-api");
  const remaining = fnIndex >= 0 ? parts.slice(fnIndex + 1) : [];
  return `/${remaining.join("/")}`;
}

async function requireSuperadmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { error: jsonResponse({ error: "Authorization required" }, 401) };

  const supabaseClient = getAuthedClient(authHeader);
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error || !user) {
    return { error: jsonResponse({ error: "Invalid authentication" }, 401) };
  }

  const supabaseAdmin = getServiceClient();
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperadmin = Boolean(profile?.is_superadmin) || (user.email ? SUPERADMIN_EMAILS.has(user.email.toLowerCase()) : false);
  if (!isSuperadmin) {
    return { error: jsonResponse({ error: "Superadmin access required" }, 403) };
  }

  return { user, supabaseAdmin };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const auth = await requireSuperadmin(req);
    if ("error" in auth) return auth.error;

    const { supabaseAdmin } = auth;
    const endpoint = getEndpointPath(req);

    if (req.method === "GET" && endpoint === "/users") {
      const { data: users, error: usersError } = await supabaseAdmin
        .from("user_profiles")
        .select("id, name, company, subscription_status, trial_ends_at, organization_id, is_superadmin, created_at")
        .order("created_at", { ascending: false });

      if (usersError) return jsonResponse({ error: usersError.message }, 500);

      const userIds = (users ?? []).map((u) => u.id);
      const { data: subscriptions } = userIds.length
        ? await supabaseAdmin
            .from("subscriptions")
            .select("id, user_id, plan_type, status, current_period_end, cancel_at_period_end, created_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false })
        : { data: [] as Array<Record<string, unknown>> };

      const latestByUser = new Map<string, Record<string, unknown>>();
      for (const s of subscriptions ?? []) {
        const uid = String(s.user_id);
        if (!latestByUser.has(uid)) latestByUser.set(uid, s);
      }

      return jsonResponse({
        users: (users ?? []).map((u) => ({
          ...u,
          subscription: latestByUser.get(u.id) ?? null,
        })),
      });
    }

    if (req.method === "GET" && endpoint === "/organizations") {
      const { data: organizations, error: orgError } = await supabaseAdmin
        .from("organizations")
        .select("id, name, owner_id, plan_type, subscription_id, created_at")
        .order("created_at", { ascending: false });

      if (orgError) return jsonResponse({ error: orgError.message }, 500);

      const orgIds = (organizations ?? []).map((o) => o.id);
      const { data: members } = orgIds.length
        ? await supabaseAdmin
            .from("organization_members")
            .select("organization_id, user_id, role")
            .in("organization_id", orgIds)
        : { data: [] as Array<Record<string, unknown>> };

      const counts = new Map<string, number>();
      for (const member of members ?? []) {
        const orgId = String(member.organization_id);
        counts.set(orgId, (counts.get(orgId) ?? 0) + 1);
      }

      return jsonResponse({
        organizations: (organizations ?? []).map((org) => ({
          ...org,
          member_count: counts.get(org.id) ?? 0,
        })),
      });
    }

    if (req.method === "POST" && endpoint === "/grant-access") {
      const body = await req.json();
      const userId = String(body?.user_id ?? "");
      const planType = String(body?.plan_type ?? "individual");
      const days = Number(body?.days ?? 30);

      if (!userId) return jsonResponse({ error: "user_id is required" }, 400);

      await supabaseAdmin
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            plan_type: planType,
            status: "active",
            current_period_end: new Date(Date.now() + days * 86400000).toISOString(),
          },
          { onConflict: "user_id,plan_type" },
        );

      await supabaseAdmin
        .from("user_profiles")
        .update({
          subscription_status: "active",
          trial_ends_at: new Date(Date.now() + days * 86400000).toISOString(),
        })
        .eq("id", userId);

      return jsonResponse({ granted: true });
    }

    if (req.method === "POST" && endpoint === "/revoke-access") {
      const body = await req.json();
      const userId = String(body?.user_id ?? "");
      if (!userId) return jsonResponse({ error: "user_id is required" }, 400);

      await supabaseAdmin.from("subscriptions").update({ status: "canceled" }).eq("user_id", userId);
      await supabaseAdmin
        .from("user_profiles")
        .update({ subscription_status: "expired", trial_ends_at: new Date().toISOString() })
        .eq("id", userId);

      return jsonResponse({ revoked: true });
    }

    if (req.method === "GET" && endpoint === "/analytics") {
      const { data: allSubscriptions, error: subsError } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id, plan_type, status, created_at");

      if (subsError) return jsonResponse({ error: subsError.message }, 500);

      const activeSubs = (allSubscriptions ?? []).filter((s) => s.status === "active" || s.status === "trialing");
      const revenueMonthlyGbp = activeSubs.reduce((sum, sub) => {
        const plan = PLAN_DETAILS[sub.plan_type as keyof typeof PLAN_DETAILS];
        return sum + (plan?.amountGbp ?? 0);
      }, 0);

      const planBreakdown = Object.keys(PLAN_DETAILS).reduce<Record<string, number>>((acc, planKey) => {
        acc[planKey] = activeSubs.filter((sub) => sub.plan_type === planKey).length;
        return acc;
      }, {});

      const { count: userCount } = await supabaseAdmin
        .from("user_profiles")
        .select("id", { count: "exact", head: true });

      const { count: orgCount } = await supabaseAdmin
        .from("organizations")
        .select("id", { count: "exact", head: true });

      return jsonResponse({
        revenue_monthly_gbp: revenueMonthlyGbp,
        active_subscriptions: activeSubs.length,
        total_users: userCount ?? 0,
        total_organizations: orgCount ?? 0,
        plan_breakdown: planBreakdown,
      });
    }

    if (req.method === "PUT" && endpoint === "/update-subscription") {
      const body = await req.json();
      const userId = String(body?.user_id ?? "");
      const planType = String(body?.plan_type ?? "individual");
      const status = String(body?.status ?? "active");
      const nextBillingDate = body?.current_period_end
        ? new Date(String(body.current_period_end)).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();

      if (!userId) return jsonResponse({ error: "user_id is required" }, 400);

      await supabaseAdmin
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            plan_type: planType,
            status,
            current_period_end: nextBillingDate,
          },
          { onConflict: "user_id,plan_type" },
        );

      await supabaseAdmin
        .from("user_profiles")
        .update({ subscription_status: status === "active" ? "active" : "expired" })
        .eq("id", userId);

      return jsonResponse({ updated: true });
    }

    return jsonResponse({ error: `Unsupported route ${req.method} ${endpoint}` }, 404);
  } catch (error) {
    console.error("admin-api error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
