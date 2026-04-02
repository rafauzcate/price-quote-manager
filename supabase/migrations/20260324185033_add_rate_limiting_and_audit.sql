/*
  # Add Rate Limiting and Audit Logging

  1. New Tables
    - `api_usage_logs`
      - Tracks all API calls for rate limiting and auditing
      - Records timestamp, user, endpoint, and status
    
    - `rate_limits`
      - Stores rate limit counters per user
      - Tracks requests per hour and per day
  
  2. Security Benefits
    - Prevents API abuse and DoS attacks
    - Audit trail for compliance and debugging
    - Ability to detect suspicious activity
    
  3. Rate Limit Defaults
    - 50 quote parses per hour
    - 200 quote parses per day
*/

-- API usage audit log
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  status text NOT NULL,
  error_message text,
  request_size_bytes integer,
  response_time_ms integer,
  ip_address inet,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API logs"
  ON api_usage_logs FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_created 
  ON api_usage_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint_created 
  ON api_usage_logs(endpoint, created_at DESC);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  requests_this_hour integer DEFAULT 0,
  requests_this_day integer DEFAULT 0,
  hour_reset_at timestamptz DEFAULT (now() + interval '1 hour'),
  day_reset_at timestamptz DEFAULT (now() + interval '1 day'),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rate limits"
  ON rate_limits FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint 
  ON rate_limits(user_id, endpoint);

-- Function to check and update rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_hourly_limit integer DEFAULT 50,
  p_daily_limit integer DEFAULT 200
)
RETURNS boolean AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  -- Get or create rate limit record
  SELECT * INTO v_record
  FROM rate_limits
  WHERE user_id = p_user_id AND endpoint = p_endpoint;
  
  IF NOT FOUND THEN
    -- First request, create record
    INSERT INTO rate_limits (user_id, endpoint, requests_this_hour, requests_this_day)
    VALUES (p_user_id, p_endpoint, 1, 1);
    RETURN true;
  END IF;
  
  -- Reset counters if time windows have passed
  IF v_now > v_record.hour_reset_at THEN
    v_record.requests_this_hour := 0;
    v_record.hour_reset_at := v_now + interval '1 hour';
  END IF;
  
  IF v_now > v_record.day_reset_at THEN
    v_record.requests_this_day := 0;
    v_record.day_reset_at := v_now + interval '1 day';
  END IF;
  
  -- Check limits
  IF v_record.requests_this_hour >= p_hourly_limit THEN
    RETURN false;
  END IF;
  
  IF v_record.requests_this_day >= p_daily_limit THEN
    RETURN false;
  END IF;
  
  -- Increment counters
  UPDATE rate_limits
  SET 
    requests_this_hour = v_record.requests_this_hour + 1,
    requests_this_day = v_record.requests_this_day + 1,
    hour_reset_at = v_record.hour_reset_at,
    day_reset_at = v_record.day_reset_at,
    updated_at = v_now
  WHERE user_id = p_user_id AND endpoint = p_endpoint;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;