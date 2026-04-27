/*
  # Remove Unused Index

  1. Performance Optimization
    - Remove unused index `idx_quotes_user_id` on quotes table
    - The index was added but is not being utilized by queries
    
  2. Important Notes
    - Auth DB Connection Strategy: Must be configured in Supabase Dashboard
      Navigate to: Settings > Database > Connection pooling
      Change from fixed connection count to percentage-based allocation
      
    - Leaked Password Protection: Must be enabled in Supabase Dashboard
      Navigate to: Authentication > Providers > Email
      Enable "Check for compromised passwords (HaveIBeenPwned.org)"
*/

-- Remove unused index on quotes.user_id
DROP INDEX IF EXISTS idx_quotes_user_id;