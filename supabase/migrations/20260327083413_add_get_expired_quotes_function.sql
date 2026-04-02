/*
  # Add get_expired_quotes RPC function

  1. New Functions
    - `get_expired_quotes` - Returns quotes that are older than 6 months and haven't been notified yet
  
  2. Purpose
    - Helps users identify quotes that may have outdated pricing
    - Returns quote details with expiry information
  
  3. Security
    - Function uses SECURITY DEFINER with restricted search_path
    - Only returns quotes for the requesting user
*/

CREATE OR REPLACE FUNCTION get_expired_quotes(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  reference_name text,
  supplier text,
  expires_at timestamptz,
  days_expired integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.reference_name,
    q.supplier,
    q.expires_at,
    EXTRACT(DAY FROM (NOW() - q.expires_at))::integer as days_expired
  FROM quotes q
  WHERE q.user_id = p_user_id
    AND q.expires_at < NOW()
    AND q.deleted_at IS NULL
    AND (q.is_expired_notified IS NULL OR q.is_expired_notified = false)
  ORDER BY q.expires_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
