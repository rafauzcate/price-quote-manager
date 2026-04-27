# Subscription System Guide

## Overview
This release adds full subscription and organization management to VantagePM using Supabase + Stripe.

### Plans
- Individual: £20/month (1 seat)
- Org 5: £50/month (5 seats)
- Org 10: £75/month (10 seats)
- Org 50: £100/month (50 seats)

All plans start with a 14-day trial.

## Database changes
Migration: `supabase/migrations/20260427130000_add_subscription_and_organization_system.sql`

### New tables
- `subscriptions`
- `organizations`
- `organization_members`
- `organization_invites`

### Updated table
- `user_profiles`:
  - `subscription_status`
  - `trial_ends_at`
  - `organization_id`
  - `is_superadmin`

## New edge functions
- `create-checkout-session`: starts Stripe checkout for selected plan.
- `stripe-webhook`: syncs Stripe subscription lifecycle to Supabase.
- `check-subscription-status`: central access check used by frontend route gating.
- `manage-organization`: create org, invite/remove members, transfer ownership, list members/invites.
- `admin-api`: superadmin controls for users/orgs/subscription analytics and manual access actions.

## Frontend changes
- Pricing page with 4 plan cards and Stripe checkout initiation.
- Route protection with subscription gate:
  - Non-paying users are redirected to pricing.
  - Superadmins bypass restrictions.
  - Trial countdown banner for active trial users.
- Admin dashboard page:
  - User management
  - Organization visibility
  - Analytics metrics/charts
- Organization settings page:
  - Create organization
  - Invite/remove members
  - List pending invites
  - View subscription details
- Settings menu now includes:
  - Subscription tab (plan + next billing date)
  - Trial status messaging
  - “Coming soon” placeholders for billing self-service

## Superadmin access
Superadmin is granted when either condition is true:
1. `user_profiles.is_superadmin = true`
2. Auth email is one of:
   - `rafael.uzcategui@gmail.com`
   - `hello@vantageprojectsolution.co.uk`

## Email templates
Email templates are generated for:
- Trial started
- Trial ending soon (3 days)
- Payment successful
- Payment failed
- Organization invite

If `RESEND_API_KEY` is missing, functions log email payloads instead of sending.
