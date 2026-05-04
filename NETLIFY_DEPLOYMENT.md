# Netlify Deployment Variables Guide

This project deploys the Vite frontend to Netlify and uses Supabase Edge Functions for backend + Stripe subscription logic.

## 1) Netlify environment variables (Frontend build)
Set these in **Netlify → Site configuration → Environment variables**:

### Required
- `VITE_SUPABASE_URL` — your Supabase project URL (example: `https://<project-ref>.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key

### Recommended (Stripe in frontend)
- `VITE_STRIPE_PUBLISHABLE_KEY` — Stripe publishable key (`pk_live_...` or `pk_test_...`)

> Note: `VITE_` prefix is required for variables that must be available in the browser build.

## 2) Stripe + subscription variables (Supabase Edge Function secrets)
These are used by Supabase Edge Functions and should be set in **Supabase secrets**, not Netlify:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_INDIVIDUAL`
- `STRIPE_PRICE_ID_ORG_5`
- `STRIPE_PRICE_ID_ORG_10`
- `STRIPE_PRICE_ID_ORG_50`
- `FRONTEND_URL` (set to your production frontend URL, e.g. `https://myvantagepm.netlify.app`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional (AI/email):
- `OPENAI_API_KEY`
- `TAVILY_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## 3) How to set variables in Netlify
1. Open your Netlify site dashboard.
2. Go to **Site configuration → Environment variables**.
3. Add each variable.
4. Click **Save**.
5. Trigger a new deploy (or redeploy latest) so changes are applied.

## 4) Build settings expected by this repository
These are defined in `netlify.toml`:
- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `18`
- Redirect rule: `/* -> /index.html (200)` for SPA routing
