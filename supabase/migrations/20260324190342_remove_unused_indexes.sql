/*
  # Remove Unused Indexes

  1. Security Improvements
    - Remove unused indexes to reduce maintenance overhead
    - Improve database performance by eliminating unnecessary index updates
    
  2. Indexes Removed
    - `idx_api_usage_logs_user_created` - Not used in queries
    - `idx_api_usage_logs_endpoint_created` - Not used in queries
    - `idx_rate_limits_user_endpoint` - Not used in queries
    - `idx_quotes_file_hash` - Not used in queries
    - `idx_line_items_description` - Not used in queries
    - `idx_quotes_expires_at` - Not used in queries
    - `idx_user_api_keys_user_id` - Not used in queries
*/

DROP INDEX IF EXISTS idx_api_usage_logs_user_created;
DROP INDEX IF EXISTS idx_api_usage_logs_endpoint_created;
DROP INDEX IF EXISTS idx_rate_limits_user_endpoint;
DROP INDEX IF EXISTS idx_quotes_file_hash;
DROP INDEX IF EXISTS idx_line_items_description;
DROP INDEX IF EXISTS idx_quotes_expires_at;
DROP INDEX IF EXISTS idx_user_api_keys_user_id;