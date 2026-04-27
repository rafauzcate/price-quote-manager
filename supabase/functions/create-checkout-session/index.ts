import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14.25.0";
import {
  PlanType,
  buildEmailTemplate,
  corsHeaders,
  getAuthedClient,
  getPriceIdForPlan,
  getServiceClient,
  jsonResponse,
  sendEmailNotification,
} from "../_shared/subscription-utils.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "http://localhost:5173";
const VALID_PLANS: PlanType[] = ["individual", "org_5", "org_10", "org_50"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    if (!STRIPE_SECRET_KEY) {
      return jsonResponse({ error: "Stripe is not configured" }, 503);
    }

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

    const body = await req.json();
    const planType = body?.plan_type as PlanType;

    if (!planType || !VALID_PLANS.includes(planType)) {
      return jsonResponse({ error: "Invalid plan type" }, 400);
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });
    const supabaseAdmin = getServiceClient();

    const { data: existingSubscription } = await supabaseAdmin
      .from("subscriptions")
      .select("id, stripe_customer_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let customerId = existingSubscription?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    const priceId = getPriceIdForPlan(planType);
    const origin = req.headers.get("origin") ?? FRONTEND_URL;

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        user_id: user.id,
        plan_type: planType,
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          user_id: user.id,
          plan_type: planType,
        },
      },
    });

    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: null,
        plan_type: planType,
        status: "incomplete",
        trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "user_id,plan_type" },
    );

    await supabaseAdmin
      .from("user_profiles")
      .update({
        subscription_status: "trialing",
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", user.id);

    if (user.email) {
      await sendEmailNotification(
        user.email,
        buildEmailTemplate("trial_started", {
          name: user.email,
          plan: planType,
          trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        }),
      );
    }

    return jsonResponse({
      checkout_url: checkoutSession.url,
      session_id: checkoutSession.id,
      plan_type: planType,
    });
  } catch (error) {
    console.error("create-checkout-session error", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
