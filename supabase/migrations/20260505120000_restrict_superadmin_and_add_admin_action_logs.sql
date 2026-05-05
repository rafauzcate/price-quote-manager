-- Restrict superadmin privileges to the approved allowlist
-- and add an audit log table for admin dashboard actions.

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_actor_id
  ON public.admin_action_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at
  ON public.admin_action_logs (created_at DESC);

ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins can view admin action logs" ON public.admin_action_logs;
CREATE POLICY "Superadmins can view admin action logs"
  ON public.admin_action_logs
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_superadmin(auth.uid()));

-- Ensure ONLY the approved emails retain superadmin privileges.
UPDATE public.user_profiles up
SET is_superadmin = EXISTS (
  SELECT 1
  FROM auth.users au
  WHERE au.id = up.id
    AND lower(au.email) IN (
      'rafael.uzcategui@gmail.com',
      'hello@vantageprojectsolution.co.uk'
    )
);
