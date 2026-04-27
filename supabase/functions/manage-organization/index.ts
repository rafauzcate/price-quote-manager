import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  buildEmailTemplate,
  corsHeaders,
  getAuthedClient,
  getPlanSeatLimit,
  getServiceClient,
  jsonResponse,
  sendEmailNotification,
} from "../_shared/subscription-utils.ts";

type ManageAction =
  | "create_organization"
  | "invite_member"
  | "remove_member"
  | "transfer_ownership"
  | "list_members";

async function requireAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { error: jsonResponse({ error: "Authorization required" }, 401) };

  const supabaseClient = getAuthedClient(authHeader);
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error || !user) return { error: jsonResponse({ error: "Invalid authentication" }, 401) };
  return { user };
}

async function canManageOrganization(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("owner_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (org?.owner_id === userId) return true;

  const { data: membership } = await supabaseAdmin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  return membership?.role === "admin" || membership?.role === "owner";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const auth = await requireAuthenticatedUser(req);
    if ("error" in auth) return auth.error;

    const user = auth.user;
    const supabaseAdmin = getServiceClient();
    const { action, payload } = (await req.json()) as { action: ManageAction; payload: Record<string, unknown> };

    if (!action) {
      return jsonResponse({ error: "Action is required" }, 400);
    }

    if (action === "create_organization") {
      const name = String(payload?.name ?? "").trim();
      if (!name) {
        return jsonResponse({ error: "Organization name is required" }, 400);
      }

      const { data: subscription } = await supabaseAdmin
        .from("subscriptions")
        .select("id, plan_type, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!subscription || !["active", "trialing"].includes(subscription.status)) {
        return jsonResponse({ error: "Active organization subscription is required" }, 403);
      }

      if (!["org_5", "org_10", "org_50"].includes(subscription.plan_type)) {
        return jsonResponse({ error: "Individual plan cannot create organizations" }, 403);
      }

      const { data: existingOwnedOrg } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (existingOwnedOrg) {
        return jsonResponse({ error: "User already owns an organization" }, 409);
      }

      const { data: organization, error: orgError } = await supabaseAdmin
        .from("organizations")
        .insert({
          name,
          owner_id: user.id,
          plan_type: subscription.plan_type,
          subscription_id: subscription.id,
        })
        .select("id, name, owner_id, plan_type, subscription_id, created_at")
        .single();

      if (orgError || !organization) {
        return jsonResponse({ error: orgError?.message ?? "Failed to create organization" }, 500);
      }

      await supabaseAdmin.from("organization_members").upsert(
        {
          organization_id: organization.id,
          user_id: user.id,
          role: "owner",
          invited_by: user.id,
        },
        { onConflict: "organization_id,user_id" },
      );

      await supabaseAdmin
        .from("user_profiles")
        .update({ organization_id: organization.id })
        .eq("id", user.id);

      return jsonResponse({ organization });
    }

    if (action === "invite_member") {
      const organizationId = String(payload?.organization_id ?? "");
      const inviteEmail = String(payload?.email ?? "").toLowerCase();
      const role = String(payload?.role ?? "member").toLowerCase();

      if (!organizationId || !inviteEmail) {
        return jsonResponse({ error: "organization_id and email are required" }, 400);
      }

      if (!["admin", "member"].includes(role)) {
        return jsonResponse({ error: "Invalid role for invite" }, 400);
      }

      const canManage = await canManageOrganization(supabaseAdmin, organizationId, user.id);
      if (!canManage) {
        return jsonResponse({ error: "Not authorized to manage this organization" }, 403);
      }

      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("id, name, plan_type")
        .eq("id", organizationId)
        .maybeSingle();

      if (!org) {
        return jsonResponse({ error: "Organization not found" }, 404);
      }

      const seats = getPlanSeatLimit(org.plan_type);
      const { count: activeMembers } = await supabaseAdmin
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId);

      const { count: pendingInvites } = await supabaseAdmin
        .from("organization_invites")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "pending");

      const consumedSeats = (activeMembers ?? 0) + (pendingInvites ?? 0);
      if (consumedSeats >= seats) {
        return jsonResponse({ error: `Seat limit reached for plan ${org.plan_type}` }, 409);
      }

      const inviteToken = crypto.randomUUID();
      const { data: inviteRow, error: inviteError } = await supabaseAdmin
        .from("organization_invites")
        .insert({
          organization_id: organizationId,
          email: inviteEmail,
          role,
          invited_by: user.id,
          invite_token: inviteToken,
        })
        .select("id, organization_id, email, role, invite_token, status, expires_at")
        .single();

      if (inviteError || !inviteRow) {
        return jsonResponse({ error: inviteError?.message ?? "Failed to create invite" }, 500);
      }

      const inviteLink = `${Deno.env.get("FRONTEND_URL") ?? "http://localhost:5173"}/accept-invite?token=${inviteToken}`;
      await sendEmailNotification(
        inviteEmail,
        buildEmailTemplate("organization_invite", {
          inviterName: user.email ?? "Organization admin",
          organizationName: org.name,
          role,
          inviteLink,
        }),
      );

      return jsonResponse({ invite: inviteRow });
    }

    if (action === "remove_member") {
      const organizationId = String(payload?.organization_id ?? "");
      const memberUserId = String(payload?.user_id ?? "");

      if (!organizationId || !memberUserId) {
        return jsonResponse({ error: "organization_id and user_id are required" }, 400);
      }

      const canManage = await canManageOrganization(supabaseAdmin, organizationId, user.id);
      if (!canManage) {
        return jsonResponse({ error: "Not authorized to manage this organization" }, 403);
      }

      await supabaseAdmin
        .from("organization_members")
        .delete()
        .eq("organization_id", organizationId)
        .eq("user_id", memberUserId);

      await supabaseAdmin
        .from("user_profiles")
        .update({ organization_id: null })
        .eq("id", memberUserId)
        .eq("organization_id", organizationId);

      return jsonResponse({ removed: true });
    }

    if (action === "transfer_ownership") {
      const organizationId = String(payload?.organization_id ?? "");
      const newOwnerUserId = String(payload?.new_owner_user_id ?? "");

      if (!organizationId || !newOwnerUserId) {
        return jsonResponse({ error: "organization_id and new_owner_user_id are required" }, 400);
      }

      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("id, owner_id")
        .eq("id", organizationId)
        .maybeSingle();

      if (!org) {
        return jsonResponse({ error: "Organization not found" }, 404);
      }

      if (org.owner_id !== user.id) {
        return jsonResponse({ error: "Only current owner can transfer ownership" }, 403);
      }

      await supabaseAdmin
        .from("organizations")
        .update({ owner_id: newOwnerUserId })
        .eq("id", organizationId);

      await supabaseAdmin.from("organization_members").upsert(
        {
          organization_id: organizationId,
          user_id: newOwnerUserId,
          role: "owner",
          invited_by: user.id,
        },
        { onConflict: "organization_id,user_id" },
      );

      await supabaseAdmin
        .from("organization_members")
        .update({ role: "admin" })
        .eq("organization_id", organizationId)
        .eq("user_id", user.id);

      await supabaseAdmin
        .from("user_profiles")
        .update({ organization_id: organizationId })
        .in("id", [newOwnerUserId, user.id]);

      return jsonResponse({ transferred: true });
    }

    if (action === "list_members") {
      const organizationId = String(payload?.organization_id ?? "");
      if (!organizationId) {
        return jsonResponse({ error: "organization_id is required" }, 400);
      }

      const canManage = await canManageOrganization(supabaseAdmin, organizationId, user.id);
      if (!canManage) {
        return jsonResponse({ error: "Not authorized to view this organization" }, 403);
      }

      const { data: members, error: membersError } = await supabaseAdmin
        .from("organization_members")
        .select("organization_id, user_id, role, invited_by, joined_at")
        .eq("organization_id", organizationId)
        .order("joined_at", { ascending: true });

      if (membersError) {
        return jsonResponse({ error: membersError.message }, 500);
      }

      const { data: invites, error: invitesError } = await supabaseAdmin
        .from("organization_invites")
        .select("id, email, role, status, expires_at, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (invitesError) {
        return jsonResponse({ error: invitesError.message }, 500);
      }

      return jsonResponse({ members: members ?? [], invites: invites ?? [] });
    }

    return jsonResponse({ error: `Unsupported action: ${action}` }, 400);
  } catch (error) {
    console.error("manage-organization error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
