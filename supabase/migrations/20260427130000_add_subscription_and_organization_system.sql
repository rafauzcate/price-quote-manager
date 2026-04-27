/*
  # Add Subscription and Organization System

  1) Adds subscription and organization management tables
  2) Adds subscription/superadmin fields to user_profiles
  3) Adds performance indexes and RLS policies
  4) Adds helper function for superadmin checks
*/

-- ---------------------------------------------------------------------------
-- Preflight: ensure columns referenced by helper functions exist
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'is_superadmin'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN is_superadmin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Ensure updated_at trigger helper exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_is_superadmin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = COALESCE(p_user_id, auth.uid())
      AND COALESCE(up.is_superadmin, false) = true
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_is_superadmin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_superadmin(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_type text NOT NULL CHECK (plan_type IN ('individual', 'org_5', 'org_10', 'org_50')),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')),
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_user_plan_unique UNIQUE (user_id, plan_type)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id_status
  ON public.subscriptions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end
  ON public.subscriptions (current_period_end);

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_superadmin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type text NOT NULL CHECK (plan_type IN ('org_5', 'org_10', 'org_50')),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id
  ON public.organizations (owner_id);

CREATE INDEX IF NOT EXISTS idx_organizations_subscription_id
  ON public.organizations (subscription_id);

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- Organization members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
  ON public.organization_members (user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_org_role
  ON public.organization_members (organization_id, role);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view relevant organization members" ON public.organization_members;
CREATE POLICY "Users can view relevant organization members"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_user_is_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_members self_member
      WHERE self_member.organization_id = organization_members.organization_id
        AND self_member.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = organization_members.organization_id
        AND o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org admins manage organization members" ON public.organization_members;
CREATE POLICY "Org admins manage organization members"
  ON public.organization_members
  FOR ALL
  TO authenticated
  USING (
    public.current_user_is_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = organization_members.organization_id
        AND o.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members actor
      WHERE actor.organization_id = organization_members.organization_id
        AND actor.user_id = auth.uid()
        AND actor.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    public.current_user_is_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = organization_members.organization_id
        AND o.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members actor
      WHERE actor.organization_id = organization_members.organization_id
        AND actor.user_id = auth.uid()
        AND actor.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Org members can view organizations" ON public.organizations;
CREATE POLICY "Org members can view organizations"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.current_user_is_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org owners can insert organizations" ON public.organizations;
CREATE POLICY "Org owners can insert organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR public.current_user_is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Org owners can update organizations" ON public.organizations;
CREATE POLICY "Org owners can update organizations"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.current_user_is_superadmin(auth.uid())
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.current_user_is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Org owners can delete organizations" ON public.organizations;
CREATE POLICY "Org owners can delete organizations"
  ON public.organizations
  FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.current_user_is_superadmin(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Optional invites table for invitation workflow and auditing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_invites_org_id ON public.organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_invites_email ON public.organization_invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_organization_invites_status ON public.organization_invites(status);

DROP TRIGGER IF EXISTS update_organization_invites_updated_at ON public.organization_invites;
CREATE TRIGGER update_organization_invites_updated_at
  BEFORE UPDATE ON public.organization_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins can manage invites" ON public.organization_invites;
CREATE POLICY "Org admins can manage invites"
  ON public.organization_invites
  FOR ALL
  TO authenticated
  USING (
    public.current_user_is_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = organization_invites.organization_id
        AND o.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members actor
      WHERE actor.organization_id = organization_invites.organization_id
        AND actor.user_id = auth.uid()
        AND actor.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    public.current_user_is_superadmin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = organization_invites.organization_id
        AND o.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members actor
      WHERE actor.organization_id = organization_invites.organization_id
        AND actor.user_id = auth.uid()
        AND actor.role IN ('owner', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- user_profiles updates
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN subscription_status text NOT NULL DEFAULT 'trialing';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN trial_ends_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'is_superadmin'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN is_superadmin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_subscription_status_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_subscription_status_check
  CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'unpaid', 'expired'));

UPDATE public.user_profiles
SET trial_ends_at = COALESCE(signup_date, created_at, now()) + interval '14 days'
WHERE trial_ends_at IS NULL;

UPDATE public.user_profiles
SET is_superadmin = true
WHERE id IN (
  SELECT id
  FROM auth.users
  WHERE lower(email) IN ('rafael.uzcategui@gmail.com', 'hello@vantageprojectsolution.co.uk')
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_status
  ON public.user_profiles (subscription_status);

CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_ends_at
  ON public.user_profiles (trial_ends_at);

CREATE INDEX IF NOT EXISTS idx_user_profiles_organization_id
  ON public.user_profiles (organization_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_superadmin
  ON public.user_profiles (is_superadmin);

-- Harden privileged profile trigger to include subscription fields
CREATE OR REPLACE FUNCTION public.protect_privileged_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  old_is_owner text;
  new_is_owner text;
  old_role text;
  new_role text;
  old_account_type text;
  new_account_type text;
  old_is_superadmin text;
  new_is_superadmin text;
  old_subscription_status text;
  new_subscription_status text;
  old_trial_ends_at text;
  new_trial_ends_at text;
  old_organization_id text;
  new_organization_id text;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  old_is_owner := COALESCE(to_jsonb(OLD)->>'is_owner', 'false');
  new_is_owner := COALESCE(to_jsonb(NEW)->>'is_owner', 'false');
  old_role := COALESCE(to_jsonb(OLD)->>'role', '');
  new_role := COALESCE(to_jsonb(NEW)->>'role', '');
  old_account_type := COALESCE(to_jsonb(OLD)->>'account_type', '');
  new_account_type := COALESCE(to_jsonb(NEW)->>'account_type', '');
  old_is_superadmin := COALESCE(to_jsonb(OLD)->>'is_superadmin', 'false');
  new_is_superadmin := COALESCE(to_jsonb(NEW)->>'is_superadmin', 'false');
  old_subscription_status := COALESCE(to_jsonb(OLD)->>'subscription_status', 'trialing');
  new_subscription_status := COALESCE(to_jsonb(NEW)->>'subscription_status', 'trialing');
  old_trial_ends_at := COALESCE(to_jsonb(OLD)->>'trial_ends_at', '');
  new_trial_ends_at := COALESCE(to_jsonb(NEW)->>'trial_ends_at', '');
  old_organization_id := COALESCE(to_jsonb(OLD)->>'organization_id', '');
  new_organization_id := COALESCE(to_jsonb(NEW)->>'organization_id', '');

  IF TG_OP = 'INSERT' THEN
    IF new_is_owner = 'true' THEN
      IF EXISTS (SELECT 1 FROM public.user_profiles WHERE COALESCE(is_owner, false) = true)
         OR NEW.id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'is_owner can only be assigned by system/admin workflows';
      END IF;
    END IF;

    IF new_role <> '' OR new_account_type <> '' OR new_is_superadmin = 'true' THEN
      RAISE EXCEPTION 'Privileged profile fields are managed by system/admin workflows only';
    END IF;

    RETURN NEW;
  END IF;

  IF new_is_owner IS DISTINCT FROM old_is_owner THEN
    RAISE EXCEPTION 'is_owner is immutable for client updates';
  END IF;

  IF new_role IS DISTINCT FROM old_role THEN
    RAISE EXCEPTION 'role is immutable for client updates';
  END IF;

  IF new_account_type IS DISTINCT FROM old_account_type THEN
    RAISE EXCEPTION 'account_type is immutable for client updates';
  END IF;

  IF new_is_superadmin IS DISTINCT FROM old_is_superadmin THEN
    RAISE EXCEPTION 'is_superadmin is immutable for client updates';
  END IF;

  IF new_subscription_status IS DISTINCT FROM old_subscription_status THEN
    RAISE EXCEPTION 'subscription_status is immutable for client updates';
  END IF;

  IF new_trial_ends_at IS DISTINCT FROM old_trial_ends_at THEN
    RAISE EXCEPTION 'trial_ends_at is immutable for client updates';
  END IF;

  IF new_organization_id IS DISTINCT FROM old_organization_id THEN
    RAISE EXCEPTION 'organization_id is immutable for client updates';
  END IF;

  RETURN NEW;
END;
$$;