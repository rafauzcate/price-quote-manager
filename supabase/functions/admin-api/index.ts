import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  PLAN_DETAILS,
  SUPERADMIN_EMAILS,
  corsHeaders,
  getAuthedClient,
  getServiceClient,
  jsonResponse,
} from "../_shared/subscription-utils.ts";

const ALLOWED_SUBSCRIPTION_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
  "expired",
]);

function normalizeEndpointPath(rawPath: string): string {
  const compact = rawPath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");

  if (!compact) return "/";
  return `/${compact}`;
}

function getEndpointPath(req: Request): string {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const fnIndex = parts.findIndex((p) => p === "admin-api");

  // Supabase usually forwards `/functions/v1/admin-api/...`, but some runtimes/proxies
  // can forward only the sub-path (`/users`, `/analytics`, etc.). Support both shapes.
  const remaining = fnIndex >= 0 ? parts.slice(fnIndex + 1) : parts;
  return normalizeEndpointPath(remaining.join("/"));
}

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function deriveDisplayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  if (!localPart) return "";
  return localPart
    .split(/[._-]+/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ")
    .slice(0, 80);
}

function resolvePlanType(input: unknown): keyof typeof PLAN_DETAILS {
  const candidate = String(input ?? "individual") as keyof typeof PLAN_DETAILS;
  return Object.prototype.hasOwnProperty.call(PLAN_DETAILS, candidate) ? candidate : "individual";
}

function resolveSubscriptionStatus(input: unknown, fallback = "active"): string {
  const candidate = String(input ?? fallback).toLowerCase();
  return ALLOWED_SUBSCRIPTION_STATUSES.has(candidate) ? candidate : fallback;
}

async function listAllAuthUsers(supabaseAdmin: ReturnType<typeof getServiceClient>) {
  const users: Array<Record<string, unknown>> = [];
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const batch = (data?.users ?? []) as Array<Record<string, unknown>>;
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }
  }

  return users;
}

async function logAdminAction(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  actorId: string,
  action: string,
  targetUserId?: string,
  metadata?: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin.from("admin_action_logs").insert({
    actor_id: actorId,
    action,
    target_user_id: targetUserId ?? null,
    metadata: metadata ?? {},
  });

  if (error) {
    console.warn("Failed to write admin action log", {
      action,
      targetUserId,
      error: error.message,
    });
  }
}

async function requireSuperadmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: jsonResponse({ error: "Authorization required" }, 401) };
  }

  const supabaseClient = getAuthedClient(authHeader);
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error || !user) {
    return { error: jsonResponse({ error: "Invalid authentication" }, 401) };
  }

  const normalizedEmail = normalizeEmail(user.email);
  if (!normalizedEmail || !SUPERADMIN_EMAILS.has(normalizedEmail)) {
    return { error: jsonResponse({ error: "Superadmin access required" }, 403) };
  }

  return { user, supabaseAdmin: getServiceClient() };
}

async function upsertUserSubscription(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  userId: string,
  planType: keyof typeof PLAN_DETAILS,
  status: string,
) {
  const normalizedStatus = resolveSubscriptionStatus(status, "active");
  const currentPeriodEnd = new Date(Date.now() + 30 * 86400000).toISOString();

  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_type: planType,
      status: normalizedStatus,
      current_period_end: currentPeriodEnd,
    },
    { onConflict: "user_id,plan_type" },
  );

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const auth = await requireSuperadmin(req);
    if ("error" in auth) return auth.error;

    const { user, supabaseAdmin } = auth;
    const endpoint = getEndpointPath(req);

    if (req.method === "GET" && endpoint === "/users") {
      const { data: users, error: usersError } = await supabaseAdmin
        .from("user_profiles")
        .select("id, name, company, subscription_status, trial_ends_at, organization_id, is_superadmin, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (usersError) return jsonResponse({ error: usersError.message }, 500);

      const authUsers = await listAllAuthUsers(supabaseAdmin);
      const authById = new Map<string, unknown>();
      for (const authUser of authUsers) {
        authById.set(String(authUser.id), authUser);
      }

      const userIds = (users ?? []).map((u) => u.id);
      const { data: subscriptions, error: subscriptionsError } = userIds.length
        ? await supabaseAdmin
            .from("subscriptions")
            .select("id, user_id, plan_type, status, current_period_end, cancel_at_period_end, created_at")
            .in("user_id", userIds)
            .order("created_at", { ascending: false })
        : { data: [] as Array<Record<string, unknown>>, error: null };

      if (subscriptionsError) return jsonResponse({ error: subscriptionsError.message }, 500);

      const latestByUser = new Map<string, Record<string, unknown>>();
      for (const s of subscriptions ?? []) {
        const uid = String(s.user_id);
        if (!latestByUser.has(uid)) latestByUser.set(uid, s);
      }

      return jsonResponse({
        users: (users ?? []).map((u) => {
          const authUser = authById.get(u.id);
          const email = normalizeEmail(authUser?.email);
          return {
            ...u,
            email,
            is_superadmin: email ? SUPERADMIN_EMAILS.has(email) : false,
            auth_created_at: authUser?.created_at ?? null,
            last_sign_in_at: authUser?.last_sign_in_at ?? null,
            subscription: latestByUser.get(u.id) ?? null,
          };
        }),
      });
    }

    if (req.method === "POST" && endpoint === "/users") {
      const body = await req.json();
      const email = normalizeEmail(body?.email);
      const company = String(body?.company ?? "").trim();
      const providedName = String(body?.name ?? "").trim();
      const planType = resolvePlanType(body?.plan_type);
      const subscriptionStatus = resolveSubscriptionStatus(body?.subscription_status, "trialing");
      const sendInvitationEmail = body?.send_invitation_email !== false;

      if (!email) return jsonResponse({ error: "email is required" }, 400);
      if (!isValidEmail(email)) return jsonResponse({ error: "email must be valid" }, 400);

      const authUsers = await listAllAuthUsers(supabaseAdmin);
      const existingAuthUser = authUsers.find((authUser) => normalizeEmail(authUser.email) === email);

      let userId = existingAuthUser?.id ? String(existingAuthUser.id) : "";
      if (!userId) {
        if (sendInvitationEmail) {
          const frontendUrl = Deno.env.get("FRONTEND_URL") ?? "https://vantagepmanagement.co.uk";
          const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${frontendUrl.replace(/\/$/, "")}/login`,
          });

          if (error) {
            return jsonResponse({ error: `Failed to invite user: ${error.message}` }, 400);
          }

          userId = data.user?.id ? String(data.user.id) : "";
        } else {
          const temporaryPassword = `Temp-${crypto.randomUUID()}-Aa1!`;
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: temporaryPassword,
            email_confirm: true,
            user_metadata: {
              source: "admin-dashboard",
            },
          });

          if (error) {
            return jsonResponse({ error: `Failed to create user: ${error.message}` }, 400);
          }

          userId = data.user?.id ? String(data.user.id) : "";
        }
      }

      if (!userId) {
        return jsonResponse({ error: "Unable to resolve created user id" }, 500);
      }

      const profileName = providedName || deriveDisplayNameFromEmail(email);
      const trialEndsAt = new Date(Date.now() + 14 * 86400000).toISOString();

      const { error: profileError } = await supabaseAdmin.from("user_profiles").upsert(
        {
          id: userId,
          name: profileName,
          company,
          subscription_status: subscriptionStatus,
          trial_ends_at: trialEndsAt,
          is_superadmin: SUPERADMIN_EMAILS.has(email),
          signup_date: new Date().toISOString(),
          last_login: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (profileError) {
        return jsonResponse({ error: `Failed to upsert profile: ${profileError.message}` }, 500);
      }

      await upsertUserSubscription(supabaseAdmin, userId, planType, subscriptionStatus === "expired" ? "canceled" : subscriptionStatus);
      await logAdminAction(supabaseAdmin, user.id, "user_created", userId, {
        email,
        company,
        plan_type: planType,
        subscription_status: subscriptionStatus,
        send_invitation_email: sendInvitationEmail,
      });

      return jsonResponse({ created: true, user_id: userId, email });
    }

    if (req.method === "PUT" && endpoint.startsWith("/users/")) {
      const userId = endpoint.replace("/users/", "").trim();
      if (!userId) return jsonResponse({ error: "user_id is required" }, 400);

      const body = await req.json();
      const planType = body?.plan_type ? resolvePlanType(body.plan_type) : null;
      const subscriptionStatus = body?.subscription_status
        ? resolveSubscriptionStatus(body.subscription_status, "active")
        : null;

      const profileUpdates: Record<string, unknown> = {};
      if (body?.company !== undefined) profileUpdates.company = String(body.company ?? "").trim();
      if (body?.name !== undefined) profileUpdates.name = String(body.name ?? "").trim();
      if (subscriptionStatus) {
        profileUpdates.subscription_status = subscriptionStatus;
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error: updateProfileError } = await supabaseAdmin
          .from("user_profiles")
          .update(profileUpdates)
          .eq("id", userId);

        if (updateProfileError) {
          return jsonResponse({ error: `Failed to update user profile: ${updateProfileError.message}` }, 500);
        }
      }

      if (planType || subscriptionStatus) {
        await upsertUserSubscription(
          supabaseAdmin,
          userId,
          planType ?? "individual",
          subscriptionStatus === "expired" ? "canceled" : (subscriptionStatus ?? "active"),
        );
      }

      await logAdminAction(supabaseAdmin, user.id, "user_updated", userId, {
        profile_updates: profileUpdates,
        plan_type: planType,
        subscription_status: subscriptionStatus,
      });

      return jsonResponse({ updated: true });
    }

    if (req.method === "DELETE" && endpoint.startsWith("/users/")) {
      const userId = endpoint.replace("/users/", "").trim();
      if (!userId) return jsonResponse({ error: "user_id is required" }, 400);

      const body = req.headers.get("content-length") ? await req.json() : {};
      const hardDelete = body?.hard_delete === true;

      const { data: authUserInfo } = await supabaseAdmin.auth.admin.getUserById(userId);
      const targetEmail = normalizeEmail(authUserInfo?.user?.email);
      if (targetEmail && SUPERADMIN_EMAILS.has(targetEmail)) {
        return jsonResponse({ error: "Cannot delete a protected superadmin account" }, 403);
      }

      const { count: ownedOrganizations, error: ownerCheckError } = await supabaseAdmin
        .from("organizations")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId);

      if (ownerCheckError) {
        return jsonResponse({ error: `Failed to validate organization ownership: ${ownerCheckError.message}` }, 500);
      }

      if ((ownedOrganizations ?? 0) > 0) {
        return jsonResponse({
          error: "Cannot delete user while they own organizations. Transfer or remove organization ownership first.",
        }, 409);
      }

      const { data: userQuotes, error: userQuotesError } = await supabaseAdmin
        .from("quotes")
        .select("id")
        .eq("user_id", userId);
      if (userQuotesError) {
        return jsonResponse({ error: `Failed to load user quotes: ${userQuotesError.message}` }, 500);
      }

      const quoteIds = (userQuotes ?? []).map((quote) => quote.id);
      if (quoteIds.length > 0) {
        const { error: lineItemsDeleteError } = await supabaseAdmin
          .from("quote_line_items")
          .delete()
          .in("quote_id", quoteIds);
        if (lineItemsDeleteError) {
          return jsonResponse({ error: `Failed to delete quote line items: ${lineItemsDeleteError.message}` }, 500);
        }
      }

      const { error: quotesDeleteError } = await supabaseAdmin.from("quotes").delete().eq("user_id", userId);
      if (quotesDeleteError) {
        return jsonResponse({ error: `Failed to delete quotes: ${quotesDeleteError.message}` }, 500);
      }

      const { error: membersDeleteError } = await supabaseAdmin.from("organization_members").delete().eq("user_id", userId);
      if (membersDeleteError) {
        return jsonResponse({ error: `Failed to delete organization memberships: ${membersDeleteError.message}` }, 500);
      }

      const { error: invitesDeleteError } = await supabaseAdmin.from("organization_invites").delete().eq("invited_by", userId);
      if (invitesDeleteError) {
        return jsonResponse({ error: `Failed to delete organization invites: ${invitesDeleteError.message}` }, 500);
      }

      const { error: subscriptionsDeleteError } = await supabaseAdmin.from("subscriptions").delete().eq("user_id", userId);
      if (subscriptionsDeleteError) {
        return jsonResponse({ error: `Failed to delete subscriptions: ${subscriptionsDeleteError.message}` }, 500);
      }

      const { error: profileDeleteError } = await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
      if (profileDeleteError) {
        return jsonResponse({ error: `Failed to delete user profile: ${profileDeleteError.message}` }, 500);
      }

      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId, !hardDelete);
      if (authDeleteError) {
        return jsonResponse({ error: `Failed to delete auth user: ${authDeleteError.message}` }, 500);
      }

      await logAdminAction(supabaseAdmin, user.id, "user_deleted", userId, {
        hard_delete: hardDelete,
        target_email: targetEmail,
      });

      return jsonResponse({ deleted: true });
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
      const planType = resolvePlanType(body?.plan_type);
      const days = Number(body?.days ?? 30);

      if (!userId) return jsonResponse({ error: "user_id is required" }, 400);

      await supabaseAdmin.from("subscriptions").upsert(
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

      await logAdminAction(supabaseAdmin, user.id, "access_granted", userId, {
        plan_type: planType,
        days,
      });

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

      await logAdminAction(supabaseAdmin, user.id, "access_revoked", userId);
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
      const planType = resolvePlanType(body?.plan_type);
      const status = resolveSubscriptionStatus(body?.status, "active");
      const nextBillingDate = body?.current_period_end
        ? new Date(String(body.current_period_end)).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();

      if (!userId) return jsonResponse({ error: "user_id is required" }, 400);

      await supabaseAdmin.from("subscriptions").upsert(
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

      await logAdminAction(supabaseAdmin, user.id, "subscription_updated", userId, {
        plan_type: planType,
        status,
        current_period_end: nextBillingDate,
      });

      return jsonResponse({ updated: true });
    }

    return jsonResponse({ error: `Unsupported route ${req.method} ${endpoint}` }, 404);
  } catch (error) {
    console.error("admin-api error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
