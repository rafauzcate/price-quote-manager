import { createClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, stripe-signature",
};

export type PlanType = "individual" | "org_5" | "org_10" | "org_50";

export const SUPERADMIN_EMAILS = new Set([
  "rafael.uzcategui@gmail.com",
  "hello@vantageprojectsolution.co.uk",
]);

export const PLAN_DETAILS: Record<PlanType, { label: string; amountGbp: number; seats: number }> = {
  individual: { label: "Individual", amountGbp: 20, seats: 1 },
  org_5: { label: "Organization 5", amountGbp: 50, seats: 5 },
  org_10: { label: "Organization 10", amountGbp: 75, seats: 10 },
  org_50: { label: "Organization 50", amountGbp: 100, seats: 50 },
};

const PRICE_ID_ENV_MAP: Record<PlanType, string> = {
  individual: "STRIPE_PRICE_ID_INDIVIDUAL",
  org_5: "STRIPE_PRICE_ID_ORG_5",
  org_10: "STRIPE_PRICE_ID_ORG_10",
  org_50: "STRIPE_PRICE_ID_ORG_50",
};

export function getPriceIdForPlan(planType: PlanType): string {
  const envName = PRICE_ID_ENV_MAP[planType];
  const value = Deno.env.get(envName);
  if (!value) {
    throw new Error(`Missing Stripe price id for ${planType}. Please set ${envName}.`);
  }
  return value;
}

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

export function getAuthedClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: authHeader },
      },
    },
  );
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getPlanSeatLimit(planType: string | null | undefined): number {
  if (!planType) return 1;
  if (planType === "individual") return 1;
  if (planType === "org_5") return 5;
  if (planType === "org_10") return 10;
  if (planType === "org_50") return 50;
  return 1;
}

export function mapStripeStatusToProfileStatus(status: string): string {
  if (status === "active" || status === "trialing") return status;
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "expired";
  if (status === "incomplete") return "incomplete";
  return "expired";
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

export function buildEmailTemplate(
  type: "trial_started" | "trial_ending" | "payment_successful" | "payment_failed" | "organization_invite",
  data: Record<string, string | number | undefined>,
): EmailTemplate {
  const appUrl = Deno.env.get("FRONTEND_URL") ?? "https://app.example.com";

  switch (type) {
    case "trial_started":
      return {
        subject: "Your 14-day VantagePM trial has started",
        html: `<p>Hi ${data.name ?? "there"},</p><p>Your trial for the <strong>${data.plan ?? "selected"}</strong> plan has started and will end on <strong>${data.trialEnd ?? "N/A"}</strong>.</p><p>Enjoy full access during trial.</p><p><a href="${appUrl}">Open VantagePM</a></p>`,
      };
    case "trial_ending":
      return {
        subject: "Trial ending soon — 3 days remaining",
        html: `<p>Hi ${data.name ?? "there"},</p><p>Your trial ends on <strong>${data.trialEnd ?? "N/A"}</strong>. Please add a payment method to keep uninterrupted access.</p><p><a href="${appUrl}/pricing">Upgrade now</a></p>`,
      };
    case "payment_successful":
      return {
        subject: "Payment successful — subscription active",
        html: `<p>Hi ${data.name ?? "there"},</p><p>Thanks! Your payment for <strong>${data.plan ?? "your plan"}</strong> was successful and your access remains active.</p><p>Next billing date: <strong>${data.nextBillingDate ?? "N/A"}</strong></p>`,
      };
    case "payment_failed":
      return {
        subject: "Payment failed — action required",
        html: `<p>Hi ${data.name ?? "there"},</p><p>We could not process your latest payment for <strong>${data.plan ?? "your plan"}</strong>. Access may be restricted until payment is resolved.</p><p><a href="${appUrl}/pricing">Update subscription</a></p>`,
      };
    case "organization_invite":
      return {
        subject: `You are invited to join ${data.organizationName ?? "an organization"}`,
        html: `<p>Hello,</p><p>${data.inviterName ?? "A team admin"} invited you to join <strong>${data.organizationName ?? "their organization"}</strong> as <strong>${data.role ?? "member"}</strong>.</p><p><a href="${data.inviteLink ?? appUrl}">Accept invitation</a></p>`,
      };
  }
}

export async function sendEmailNotification(to: string, template: EmailTemplate): Promise<void> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@vantageprojectsolution.co.uk";

  if (!resendKey) {
    console.log("[email-placeholder]", { to, subject: template.subject, html: template.html });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: template.subject,
      html: template.html,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error("Failed to send email", response.status, errBody);
  }
}
