/*
  # Add Account Types and Invitation System

  ## Overview
  This migration implements a dual-mode authentication system:
  - Single users: Can sign up without invitation
  - Company users: Require invitation code from superadmin

  ## Changes
  1. Tables
    - Add `company_invitations` table for invitation codes
    - Add `account_type` to user_profiles
  
  2. Security
    - Enable RLS on company_invitations
    - Add policies for invitation management
    - Update user_profiles policies

  ## Important Notes
  - Invitation codes are unique and expire after 7 days by default
  - Single users have their own isolated workspace
  - Company users share data within their company
*/

-- Add account_type to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN account_type text NOT NULL DEFAULT 'single' CHECK (account_type IN ('single', 'company'));
  END IF;
END $$;

-- Create company_invitations table
CREATE TABLE IF NOT EXISTS company_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  max_uses integer DEFAULT 1,
  current_uses integer DEFAULT 0,
  is_active boolean DEFAULT true
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_invitations_code ON company_invitations(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_invitations_company ON company_invitations(company_id);

-- Enable RLS
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_invitations

-- Superusers can view their company's invitations
CREATE POLICY "Superusers can view company invitations"
  ON company_invitations FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = (SELECT auth.uid())
      AND role = 'superuser'
    )
  );

-- Superusers can create invitations for their company
CREATE POLICY "Superusers can create invitations"
  ON company_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = (SELECT auth.uid())
      AND role = 'superuser'
    )
    AND created_by = (SELECT auth.uid())
  );

-- Superusers can update their company's invitations
CREATE POLICY "Superusers can update invitations"
  ON company_invitations FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = (SELECT auth.uid())
      AND role = 'superuser'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = (SELECT auth.uid())
      AND role = 'superuser'
    )
  );

-- Superusers can delete their company's invitations
CREATE POLICY "Superusers can delete invitations"
  ON company_invitations FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = (SELECT auth.uid())
      AND role = 'superuser'
    )
  );

-- Function to validate and use invitation code
CREATE OR REPLACE FUNCTION use_invitation_code(invitation_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
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