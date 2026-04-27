/*
  # P0 Security Hardening

  Addresses critical findings:
  - F-03: IDOR in get_expired_quotes RPC
  - F-04/F-05: Privilege escalation via mutable is_owner and broad encrypted_api_keys owner policies
*/

-- ---------------------------------------------------------------------------
-- F-03: Bind expired quote access to session identity (auth.uid())
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_expired_quotes(uuid);

CREATE OR REPLACE FUNCTION public.get_expired_quotes()
RETURNS TABLE (
  id uuid,
  reference_name text,
  supplier text,
  expires_at timestamptz,
  days_expired integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.reference_name,
    q.supplier,
    q.expires_at,
    EXTRACT(DAY FROM (now() - q.expires_at))::integer AS days_expired
  FROM public.quotes q
  WHERE q.user_id = v_uid
    AND q.expires_at < now()
    AND q.deleted_at IS NULL
    AND COALESCE(q.is_expired_notified, false) = false
  ORDER BY q.expires_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_expired_quotes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_expired_quotes() TO authenticated;

-- ---------------------------------------------------------------------------
-- F-04: Prevent privilege escalation by blocking direct writes to privileged
--       profile fields (is_owner / role / account_type) for non-service roles.
-- ---------------------------------------------------------------------------
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
BEGIN
  -- System level operations (service role) are allowed.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  old_is_owner := COALESCE(to_jsonb(OLD)->>'is_owner', 'false');
  new_is_owner := COALESCE(to_jsonb(NEW)->>'is_owner', 'false');
  old_role := COALESCE(to_jsonb(OLD)->>'role', '');
  new_role := COALESCE(to_jsonb(NEW)->>'role', '');
  old_account_type := COALESCE(to_jsonb(OLD)->>'account_type', '');
  new_account_type := COALESCE(to_jsonb(NEW)->>'account_type', '');

  IF TG_OP = 'INSERT' THEN
    -- Allow automatic first-owner bootstrap only when no owner exists yet.
    IF new_is_owner = 'true' THEN
      IF EXISTS (SELECT 1 FROM public.user_profiles WHERE COALESCE(is_owner, false) = true)
         OR NEW.id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'is_owner can only be assigned by system/admin workflows';
      END IF;
    END IF;

    IF new_role <> '' OR new_account_type <> '' THEN
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_privileged_profile_columns_trigger ON public.user_profiles;
CREATE TRIGGER protect_privileged_profile_columns_trigger
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_privileged_profile_columns();

-- ---------------------------------------------------------------------------
-- F-05: Replace broad owner-only encrypted_api_keys policies with per-user
--       row ownership isolation (when table exists).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.encrypted_api_keys') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Only owner can view api keys" ON public.encrypted_api_keys';
    EXECUTE 'DROP POLICY IF EXISTS "Only owner can insert api keys" ON public.encrypted_api_keys';
    EXECUTE 'DROP POLICY IF EXISTS "Only owner can update api keys" ON public.encrypted_api_keys';
    EXECUTE 'DROP POLICY IF EXISTS "Only owner can delete api keys" ON public.encrypted_api_keys';

    EXECUTE 'DROP POLICY IF EXISTS "Users can view own api keys" ON public.encrypted_api_keys';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own api keys" ON public.encrypted_api_keys';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own api keys" ON public.encrypted_api_keys';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own api keys" ON public.encrypted_api_keys';

    EXECUTE '
      CREATE POLICY "Users can view own api keys"
      ON public.encrypted_api_keys FOR SELECT
      TO authenticated
      USING (user_id = auth.uid())
    ';

    EXECUTE '
      CREATE POLICY "Users can insert own api keys"
      ON public.encrypted_api_keys FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid())
    ';

    EXECUTE '
      CREATE POLICY "Users can update own api keys"
      ON public.encrypted_api_keys FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid())
    ';

    EXECUTE '
      CREATE POLICY "Users can delete own api keys"
      ON public.encrypted_api_keys FOR DELETE
      TO authenticated
      USING (user_id = auth.uid())
    ';
  END IF;
END;
$$;
