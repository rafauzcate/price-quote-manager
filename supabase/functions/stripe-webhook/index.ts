import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.25.0";
import {
  PlanType,
  SUPERADMIN_EMAILS,
  buildEmailTemplate,
  corsHeaders,
  getServiceClient,
  jsonResponse,
  mapStripeStatusToProfileStatus,
  sendEmailNotification,
} from "../_shared/subscription-utils.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

function planFromPriceId(priceId: string | null | undefined): PlanType {
  if (!priceId) return "individual";
  if (priceId === Deno.env.get("STRIPE_PRICE_ID_ORG_5")) return "org_5";
  if (priceId === Deno.env.get("STRIPE_PRICE_ID_ORG_10")) return "org_10";
  if (priceId === Deno.env.get("STRIPE_PRICE_ID_ORG_50")) return "org_50";
  return "individual";
}

async function ensureOrganizationForPlan(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  userId: string,
  planType: PlanType,
  subscriptionId: string,
) {
  if (planType === "individual") {
    await supabaseAdmin.from("user_profiles").update({ organization_id: null }).eq("id", userId);
    return;
  }

  const { data: existingOrg } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();

  let organizationId = existingOrg?.id;
  if (!organizationId) {
    const { data: createdOrg, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: "My Organization",
        owner_id: userId,
        plan_type: planType,
        subscription_id: subscriptionId,
      })
      .select("id")
      .single();

    if (orgError) {
      console.error("Failed to create org", orgError);
      return;
    }

    organizationId = createdOrg.id;
  } else {
    await supabaseAdmin
      .from("organizations")
      .update({
        plan_type: planType,
        subscription_id: subscriptionId,
      })
      .eq("id", organizationId);
  }

  if (!organizationId) return;

  await supabaseAdmin.from("organization_members").upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      role: "owner",
      invited_by: userId,
    },
    { onConflict: "organization_id,user_id" },
  );

  await supabaseAdmin.from("user_profiles").update({ organization_id: organizationId }).eq("id", userId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      return jsonResponse({ error: "Stripe webhook is not configured" }, 503);
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return jsonResponse({ error: "Missing stripe-signature header" }, 400);
    }

    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, STRIPE_WEBHOOK_SECRET);
    const supabaseAdmin = getServiceClient();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = (session.customer as string) ?? null;
      const stripeSubscriptionId = (session.subscription as string) ?? null;
      const userId = (session.metadata?.user_id ?? session.client_reference_id) as string | null;
      const planType = (session.metadata?.plan_type as PlanType | undefined) ?? "individual";

      if (!userId || !stripeSubscriptionId) {
        return jsonResponse({ received: true, skipped: true });
      }

      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

      const upsertPayload = {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSubscription.id,
        plan_type: planType,
        status: stripeSubscription.status,
        trial_end: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000).toISOString()
          : null,
        current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      };

      const { data: savedSubscription } = await supabaseAdmin
        .from("subscriptions")
        .upsert(upsertPayload, { onConflict: "stripe_subscription_id" })
        .select("id")
        .single();

      await supabaseAdmin
        .from("user_profiles")
        .update({
          subscription_status: mapStripeStatusToProfileStatus(stripeSubscription.status),
          trial_ends_at: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000).toISOString()
            : null,
        })
        .eq("id", userId);

      if (savedSubscription?.id) {
        await ensureOrganizationForPlan(supabaseAdmin, userId, planType, savedSubscription.id);
      }

      const { data: profile } = await supabaseAdmin
        .from("user_profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
        const email = authUser?.user?.email;

        if (email) {
          await sendEmailNotification(
            email,
            buildEmailTemplate("payment_successful", {
              name: email,
              plan: planType,
              nextBillingDate: new Date(stripeSubscription.current_period_end * 1000).toISOString().split("T")[0],
            }),
          );
        }
      }
    }

    if (event.type === "customer.subscription.updated") {
      const stripeSubscription = event.data.object as Stripe.Subscription;
      const userId = stripeSubscription.metadata?.user_id ?? null;
      const planType =
        (stripeSubscription.metadata?.plan_type as PlanType | undefined) ||
        planFromPriceId(stripeSubscription.items.data[0]?.price?.id);

      const { data: matchingSubscription } = await supabaseAdmin
        .from("subscriptions")
        .select("id, user_id")
        .eq("stripe_subscription_id", stripeSubscription.id)
        .maybeSingle();

      const effectiveUserId = userId ?? matchingSubscription?.user_id ?? null;
      if (!effectiveUserId) {
        return jsonResponse({ received: true, skipped: true });
      }

      await supabaseAdmin.from("subscriptions").upsert(
        {
          id: matchingSubscription?.id,
          user_id: effectiveUserId,
          stripe_customer_id: stripeSubscription.customer as string,
          stripe_subscription_id: stripeSubscription.id,
          plan_type: planType,
          status: stripeSubscription.status,
          trial_end: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000).toISOString()
            : null,
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        },
        { onConflict: "stripe_subscription_id" },
      );

      await supabaseAdmin
        .from("user_profiles")
        .update({
          subscription_status: mapStripeStatusToProfileStatus(stripeSubscription.status),
          trial_ends_at: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * 1000).toISOString()
            : null,
        })
        .eq("id", effectiveUserId);

      const trialEndDate = stripeSubscription.trial_end
        ? new Date(stripeSubscription.trial_end * 1000)
        : null;
      if (trialEndDate) {
        const daysLeft = Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 3 && daysLeft >= 0) {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(effectiveUserId);
          const email = authUser?.user?.email;
          if (email && !SUPERADMIN_EMAILS.has(email.toLowerCase())) {
            await sendEmailNotification(
              email,
              buildEmailTemplate("trial_ending", {
                name: email,
                trialEnd: trialEndDate.toISOString().split("T")[0],
              }),
            );
          }
        }
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const stripeSubscription = event.data.object as Stripe.Subscription;
      const { data: matchingSubscription } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", stripeSubscription.id)
        .maybeSingle();

      if (matchingSubscription?.user_id) {
        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: true,
          })
          .eq("stripe_subscription_id", stripeSubscription.id);

        await supabaseAdmin
          .from("user_profiles")
          .update({ subscription_status: "expired" })
          .eq("id", matchingSubscription.user_id);
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;

      if (stripeSubscriptionId) {
        const { data: matchingSubscription } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id, plan_type")
          .eq("stripe_subscription_id", stripeSubscriptionId)
          .maybeSingle();

        if (matchingSubscription?.user_id) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "unpaid" })
            .eq("stripe_subscription_id", stripeSubscriptionId);

          await supabaseAdmin
            .from("user_profiles")
            .update({
              subscription_status: "expired",
              trial_ends_at: new Date().toISOString(),
            })
            .eq("id", matchingSubscription.user_id);

          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(matchingSubscription.user_id);
          const email = authUser?.user?.email;
          if (email) {
            await sendEmailNotification(
              email,
              buildEmailTemplate("payment_failed", {
                name: email,
                plan: matchingSubscription.plan_type,
              }),
            );
          }
        }
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error("stripe-webhook error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
  }
});
