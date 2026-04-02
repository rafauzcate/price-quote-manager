/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add index on `api_usage_logs.user_id` to optimize foreign key lookups
    - Add index on `quotes.user_id` to optimize foreign key lookups
    
  2. Impact
    - Improves query performance for joins and lookups on these foreign keys
    - Prevents full table scans when querying by user_id
    - Essential for scalability as data grows

  Note: These indexes should have been created automatically with the foreign keys,
  but adding them explicitly ensures optimal query performance.
*/

-- Add index for api_usage_logs.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id 
ON api_usage_logs(user_id);

-- Add index for quotes.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_quotes_user_id 
ON quotes(user_id);
