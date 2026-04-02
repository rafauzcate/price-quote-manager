/*
  # Fix Function Search Path Security

  1. Security Improvements
    - Set explicit search_path for all functions to prevent search path injection attacks
    - Use SECURITY DEFINER functions safely by locking down the search_path
    
  2. Functions Updated
    - `check_rate_limit` - Add explicit search_path
    - `set_quote_expiry` - Add explicit search_path
    - `get_expired_quotes` - Add explicit search_path
    
  3. Security Notes
    - Setting search_path to empty string or specific schemas prevents malicious users
      from creating objects in other schemas that could be executed by the function
    - All functions use qualified table names (public.table_name) for safety
*/

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_hourly_limit integer DEFAULT 50,
  p_daily_limit integer DEFAULT 200
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hourly_count integer;
  v_daily_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_hourly_count
  FROM public.api_usage_logs
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND created_at > now() - interval '1 hour';

  SELECT COUNT(*)
  INTO v_daily_count
  FROM public.api_usage_logs
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND created_at > now() - interval '1 day';

  IF v_hourly_count >= p_hourly_limit OR v_daily_count >= p_daily_limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.api_usage_logs (user_id, endpoint)
  VALUES (p_user_id, p_endpoint);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_quote_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.created_at + interval '6 months';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_expired_quotes(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  reference_name text,
  supplier text,
  expires_at timestamptz,
  days_expired integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.reference_name,
    q.supplier,
    q.expires_at,
    EXTRACT(DAY FROM (now() - q.expires_at))::integer as days_expired
  FROM public.quotes q
  WHERE q.user_id = p_user_id
    AND q.expires_at < now()
    AND q.is_expired_notified = false
  ORDER BY q.expires_at ASC;
END;
$$;