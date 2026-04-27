/*
  # Revert to Single User Version

  ## Overview
  Removes all company and multi-user features and restores simple single-user functionality.

  ## Changes
  1. Drop all existing policies first
  2. Drop company-related tables
  3. Simplify user_profiles table
  4. Create simple single-user policies

  ## Security
  - Users can only access their own data
  - Maintains authentication requirements
*/

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;

DROP POLICY IF EXISTS "Users can view their quotes" ON quotes;
DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update their quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete their quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;

DROP POLICY IF EXISTS "Users can view their line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can view own line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can insert their line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can insert own line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can update their line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can update own line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can delete their line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can delete own line items" ON quote_line_items;

-- Drop company-related tables
DROP TABLE IF EXISTS company_invitations CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- Remove company-related columns from user_profiles
ALTER TABLE user_profiles 
  DROP COLUMN IF EXISTS company_id CASCADE,
  DROP COLUMN IF EXISTS role CASCADE,
  DROP COLUMN IF EXISTS account_type CASCADE,
  DROP COLUMN IF EXISTS is_active CASCADE;

-- Create simple single-user policies for user_profiles
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Create simple single-user policies for quotes
CREATE POLICY "Users can view own quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Create simple single-user policies for quote_line_items
CREATE POLICY "Users can view own line items"
  ON quote_line_items FOR SELECT
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own line items"
  ON quote_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own line items"
  ON quote_line_items FOR UPDATE
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own line items"
  ON quote_line_items FOR DELETE
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = (SELECT auth.uid())
    )
  );