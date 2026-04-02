/*
  # Fix Security and Performance Issues

  ## Overview
  Addresses multiple security and performance issues identified in the database audit:
  - Adds missing indexes for foreign keys
  - Removes duplicate/unused policies
  - Fixes function search path security
  - Adds proper RLS policy restrictions

  ## Changes
  1. Indexes
    - Add indexes for unindexed foreign keys
    - Remove unused indexes
  
  2. Security
    - Drop duplicate permissive policies
    - Fix function search_path to be immutable
    - Add proper restrictions to company creation policy
  
  ## Performance Impact
  - Improved query performance on foreign key lookups
  - Reduced policy evaluation overhead
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_company_invitations_created_by 
  ON company_invitations(created_by);

CREATE INDEX IF NOT EXISTS idx_quotes_company_id 
  ON quotes(company_id);

CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id 
  ON user_profiles(company_id);

-- Remove unused indexes
DROP INDEX IF EXISTS idx_quotes_user_id;
DROP INDEX IF EXISTS idx_invitations_code;
DROP INDEX IF EXISTS idx_invitations_company;

-- Create optimized index for invitation code lookups
CREATE INDEX IF NOT EXISTS idx_invitations_active_code 
  ON company_invitations(code, company_id) 
  WHERE is_active = true;

-- Fix duplicate policies on quotes table
DROP POLICY IF EXISTS "Users can view company quotes" ON quotes;
DROP POLICY IF EXISTS "Active users can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;

-- Fix duplicate policies on quote_line_items table
DROP POLICY IF EXISTS "Users can view company line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can insert line items for company quotes" ON quote_line_items;
DROP POLICY IF EXISTS "Users can update line items for own quotes" ON quote_line_items;
DROP POLICY IF EXISTS "Users can delete line items for own quotes" ON quote_line_items;

-- Fix duplicate policies on user_profiles table
DROP POLICY IF EXISTS "Superusers can update company users" ON user_profiles;

-- Recreate use_invitation_code function with immutable search_path
DROP FUNCTION IF EXISTS use_invitation_code(text);

CREATE OR REPLACE FUNCTION use_invitation_code(invitation_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  invitation_record company_invitations;
  company_id_result uuid;
BEGIN
  -- Get the invitation
  SELECT * INTO invitation_record
  FROM company_invitations
  WHERE code = invitation_code
    AND is_active = true
    AND expires_at > now()
    AND (max_uses IS NULL OR current_uses < max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation code';
  END IF;

  -- Increment usage
  UPDATE company_invitations
  SET current_uses = current_uses + 1,
      is_active = CASE 
        WHEN max_uses IS NOT NULL AND current_uses + 1 >= max_uses THEN false
        ELSE is_active
      END
  WHERE id = invitation_record.id;

  RETURN invitation_record.company_id;
END;
$$;

-- Fix company creation policy to be restrictive
DROP POLICY IF EXISTS "Authenticated users can create companies" ON companies;

CREATE POLICY "Users can create company"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Only allow company creation if user doesn't already have a company
    NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = (SELECT auth.uid())
      AND company_id IS NOT NULL
    )
  );

-- Update user_profiles update policy to be more restrictive
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
  )
  WITH CHECK (
    id = (SELECT auth.uid())
  );