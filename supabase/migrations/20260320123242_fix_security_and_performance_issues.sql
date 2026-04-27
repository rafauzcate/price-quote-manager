/*
  # Fix Security and Performance Issues

  ## Overview
  This migration addresses multiple security and performance issues identified by Supabase:

  ## Changes

  ### 1. Performance Optimizations
  - Add missing index on quotes.user_id foreign key
  - Fix all RLS policies to use (select auth.uid()) pattern for better performance
  - Fix function search paths to be immutable

  ### 2. Index Management
  - Remove unused indexes that were created but not being utilized

  ## Security
  - All RLS policies updated to use optimized auth function calls
  - Functions updated with stable search paths

  ## Impact
  - Improved query performance at scale
  - Reduced database overhead from RLS policy evaluation
  - Better index utilization
*/

-- Add missing index on quotes.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);

-- Drop and recreate all RLS policies with optimized auth.uid() calls

-- Companies policies
DROP POLICY IF EXISTS "Users can view their company" ON companies;
CREATE POLICY "Users can view their company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
    )
  );

-- User profiles policies
DROP POLICY IF EXISTS "Users can view profiles in their company" ON user_profiles;
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Superusers can update company users" ON user_profiles;
CREATE POLICY "Superusers can update company users"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = (select auth.uid()) AND role = 'superuser'
    )
    AND id != (select auth.uid())
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = (select auth.uid()) AND role = 'superuser'
    )
    AND id != (select auth.uid())
  );

-- Quotes policies
DROP POLICY IF EXISTS "Users can view company quotes" ON quotes;
CREATE POLICY "Users can view company quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (select auth.uid()) AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Active users can insert quotes" ON quotes;
CREATE POLICY "Active users can insert quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = (select auth.uid()) AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
CREATE POLICY "Users can update own quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;
CREATE POLICY "Users can delete own quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Quote line items policies
DROP POLICY IF EXISTS "Users can view company line items" ON quote_line_items;
CREATE POLICY "Users can view company line items"
  ON quote_line_items FOR SELECT
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes WHERE company_id IN (
        SELECT company_id FROM user_profiles WHERE id = (select auth.uid()) AND is_active = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert line items for company quotes" ON quote_line_items;
CREATE POLICY "Users can insert line items for company quotes"
  ON quote_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update line items for own quotes" ON quote_line_items;
CREATE POLICY "Users can update line items for own quotes"
  ON quote_line_items FOR UPDATE
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete line items for own quotes" ON quote_line_items;
CREATE POLICY "Users can delete line items for own quotes"
  ON quote_line_items FOR DELETE
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = (select auth.uid())
    )
  );

-- Fix function search paths to be stable
DROP FUNCTION IF EXISTS get_email_domain(text) CASCADE;
CREATE OR REPLACE FUNCTION get_email_domain(email text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN lower(split_part(email, '@', 2));
END;
$$;

DROP FUNCTION IF EXISTS auto_assign_company() CASCADE;
CREATE OR REPLACE FUNCTION auto_assign_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_email text;
  email_domain text;
  target_company_id uuid;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  
  email_domain := get_email_domain(user_email);
  
  SELECT id INTO target_company_id FROM companies WHERE domain = email_domain;
  
  IF target_company_id IS NOT NULL THEN
    NEW.company_id := target_company_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS auto_assign_quote_company() CASCADE;
CREATE OR REPLACE FUNCTION auto_assign_quote_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_company_id uuid;
BEGIN
  SELECT company_id INTO user_company_id FROM user_profiles WHERE id = NEW.user_id;
  
  IF user_company_id IS NOT NULL THEN
    NEW.company_id := user_company_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate triggers after function changes
DROP TRIGGER IF EXISTS auto_assign_company_trigger ON user_profiles;
CREATE TRIGGER auto_assign_company_trigger
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_company();

DROP TRIGGER IF EXISTS auto_assign_quote_company_trigger ON quotes;
CREATE TRIGGER auto_assign_quote_company_trigger
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_quote_company();

-- Remove unused indexes (they will be created when actually needed by queries)
DROP INDEX IF EXISTS idx_companies_domain;
DROP INDEX IF EXISTS idx_user_profiles_company_id;
DROP INDEX IF EXISTS idx_quotes_company_id;