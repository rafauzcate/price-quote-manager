import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  SUPERADMIN_EMAILS,
  buildEmailTemplate,
  corsHeaders,
  getAuthedClient,
  getServiceClient,
  jsonResponse,
  sendEmailNotification,
} from "../_shared/subscription-utils.ts";

function calculateDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authorization required" }, 401);
    }

    const supabaseClient = getAuthedClient(authHeader);
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Invalid authentication" }, 401);
    }

    const supabaseAdmin = getServiceClient();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("id, subscription_status, trial_ends_at, is_superadmin, organization_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return jsonResponse({ error: "User profile not found" }, 404);
    }

    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("id, plan_type, status, trial_end, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const normalizedEmail = user.email?.toLowerCase() ?? null;
    const isSuperadmin = normalizedEmail ? SUPERADMIN_EMAILS.has(normalizedEmail) : false;

    let hasAccess = false;
    let accessReason = "no_active_subscription";

    if (isSuperadmin) {
      hasAccess = true;
      accessReason = "superadmin";
    } else if (subscription?.status === "active" || subscription?.status === "trialing") {
      hasAccess = true;
      accessReason = subscription.status;
    } else {
      const trialDaysRemaining = calculateDaysRemaining(profile.trial_ends_at);
      if (trialDaysRemaining > 0) {
        hasAccess = true;
        accessReason = "profile_trial";

        if (trialDaysRemaining <= 3 && user.email) {
          await sendEmailNotification(
            user.email,
            buildEmailTemplate("trial_ending", {
              name: user.email,
              trialEnd: profile.trial_ends_at?.split("T")[0],
            }),
          );
        }
      }
    }

    return jsonResponse({
      has_access: hasAccess,
      access_reason: accessReason,
      is_superadmin: isSuperadmin,
      profile: {
        subscription_status: profile.subscription_status,
        trial_ends_at: profile.trial_ends_at,
        organization_id: profile.organization_id,
      },
      subscription: subscription ?? null,
      permissions: {
        can_use_all_features: hasAccess,
        can_manage_admin_dashboard: isSuperadmin,
        can_manage_organization:
          !!subscription && ["org_5", "org_10", "org_50"].includes(subscription.plan_type),
      },
      trial_days_remaining: calculateDaysRemaining(profile.trial_ends_at),
    });
  } catch (error) {
    console.error("check-subscription-status error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
