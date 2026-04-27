/*
  # Fix Security and Performance Issues

  1. Performance Improvements
    - Add index on `quotes.user_id` to optimize foreign key lookups
    - Remove unused index `idx_user_profiles_id` (primary key already indexed)
    
  2. RLS Policy Optimization
    - Update all RLS policies to use `(select auth.uid())` pattern
    - This prevents re-evaluation of auth.uid() for each row
    
  3. Function Security
    - Fix search_path mutability issue in update_updated_at_column function

  4. Important Notes
    - Auth DB connection strategy and leaked password protection are project-level settings
    - These cannot be changed via SQL migrations and must be configured in Supabase Dashboard
*/

-- Add index for quotes.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);

-- Remove unused index on user_profiles.id (primary key is already indexed)
DROP INDEX IF EXISTS idx_user_profiles_id;

-- Drop existing RLS policies for user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Recreate optimized RLS policies using (select auth.uid()) pattern
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- Fix function search_path mutability issue
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;