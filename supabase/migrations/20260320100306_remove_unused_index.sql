/*
  # Remove Unused Index and Security Fixes

  1. Index Optimization
    - Drop unused `idx_quotes_user_id` index on quotes table
    - This index has not been used by any queries and is consuming resources
    - The queries are efficiently using RLS policies without needing this index
    
  2. Security Notes
    - Auth DB Connection Strategy: This is a Supabase project configuration setting
      that must be changed through the Supabase Dashboard under Settings > Database
      Switch from fixed connection limit to percentage-based allocation
      
    - Leaked Password Protection: This is a Supabase Auth configuration setting
      that must be enabled through the Supabase Dashboard under Authentication > Policies
      Enable "Check for compromised passwords" to use HaveIBeenPwned.org
      
  3. Notes
    - Removing unused indexes improves write performance and reduces storage
    - The remaining indexes (PKs and quote_line_items.quote_id) are actively used
*/

-- Drop unused index on quotes.user_id
DROP INDEX IF EXISTS idx_quotes_user_id;
