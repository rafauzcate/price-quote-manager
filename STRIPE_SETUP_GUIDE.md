# Stripe Setup Guide

## 1) Create products and recurring prices
Create four monthly prices in Stripe Dashboard:

- Individual — £20/month
- Organization 5 — £50/month
- Organization 10 — £75/month
- Organization 50 — £100/month

Copy each **Price ID** into environment variables:

- `STRIPE_PRICE_ID_INDIVIDUAL`
- `STRIPE_PRICE_ID_ORG_5`
- `STRIPE_PRICE_ID_ORG_10`
- `STRIPE_PRICE_ID_ORG_50`

## 2) Configure secrets in Supabase Edge Functions
Set secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 3) Deploy edge functions
Deploy these functions:

- `create-checkout-session`
- `stripe-webhook`
- `check-subscription-status`
- `manage-organization`
- `admin-api`

## 4) Configure Stripe webhook endpoint
Add webhook endpoint in Stripe:

`https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`

Subscribe to events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Use the webhook signing secret value as `STRIPE_WEBHOOK_SECRET`.

## 5) Test end-to-end
1. Create test user and log in.
2. Open Pricing page and start trial for any plan.
3. Complete Stripe checkout in test mode.
4. Confirm subscription and profile fields update:
   - `subscriptions`
   - `user_profiles.subscription_status`
   - `user_profiles.trial_ends_at`
5. For org plan, confirm organization is created and owner is added to `organization_members`.
