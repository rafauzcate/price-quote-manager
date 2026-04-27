/*
  # Add Companies and Multi-User Support

  ## Overview
  This migration transforms the application into a multi-tenant system where:
  - Companies can have multiple users
  - Superusers can manage their company's users
  - All users in a company share access to the same quotes database
  - Email domain-based company association

  ## New Tables
  
  ### `companies`
  - `id` (uuid, primary key) - Unique company identifier
  - `name` (text) - Company name (e.g., "GEL ENGINEERING")
  - `domain` (text, unique) - Email domain (e.g., "gelengineering.co.uk")
  - `created_at` (timestamptz) - When company was created
  
  ## Modified Tables
  
  ### `user_profiles`
  - Added `company_id` (uuid, foreign key) - Links user to their company
  - Added `role` (text) - User role: 'superuser' or 'user'
  - Added `is_active` (boolean) - Whether user account is active (for superuser management)
  
  ### `quotes`
  - Added `company_id` (uuid, foreign key) - Links quote to company for easier querying
  
  ## Security Changes
  
  ### RLS Policies Updated
  - Users can view all quotes from their company
  - Users can insert quotes for their company
  - Users can update/delete their own quotes
  - Superusers can manage users in their company
  - Company-wide data sharing enabled
  
  ## Performance
  - Added indexes on company_id foreign keys
  - Added index on companies.domain for email lookup
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Add company_id and role to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN role text DEFAULT 'user' CHECK (role IN ('superuser', 'user'));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Add company_id to quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can view own quote line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can insert own quote line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can update own quote line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can delete own quote line items" ON quote_line_items;

-- Companies policies
CREATE POLICY "Users can view their company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- User profiles policies (company-wide access)
CREATE POLICY "Users can view profiles in their company"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Superusers can update company users"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'superuser'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM user_profiles 
      WHERE id = auth.uid() AND role = 'superuser'
    )
  );

-- Quotes policies (company-wide access)
CREATE POLICY "Users can view company quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Active users can insert quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    company_id IN (
      SELECT company_id FROM user_profiles WHERE id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can update own quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Line items policies (company-wide access through quotes)
CREATE POLICY "Users can view company line items"
  ON quote_line_items FOR SELECT
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes WHERE company_id IN (
        SELECT company_id FROM user_profiles WHERE id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY "Users can insert line items for company quotes"
  ON quote_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update line items for own quotes"
  ON quote_line_items FOR UPDATE
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete line items for own quotes"
  ON quote_line_items FOR DELETE
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes WHERE user_id = auth.uid()
    )
  );

-- Function to extract domain from email
CREATE OR REPLACE FUNCTION get_email_domain(email text)
RETURNS text AS $$
BEGIN
  RETURN lower(split_part(email, '@', 2));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to auto-assign company based on email domain
CREATE OR REPLACE FUNCTION auto_assign_company()
RETURNS trigger AS $$
DECLARE
  user_email text;
  email_domain text;
  target_company_id uuid;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  
  -- Extract domain
  email_domain := get_email_domain(user_email);
  
  -- Find matching company
  SELECT id INTO target_company_id FROM companies WHERE domain = email_domain;
  
  -- Assign company if found
  IF target_company_id IS NOT NULL THEN
    NEW.company_id := target_company_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-assign company on user profile creation
DROP TRIGGER IF EXISTS auto_assign_company_trigger ON user_profiles;
CREATE TRIGGER auto_assign_company_trigger
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_company();

-- Function to auto-assign company_id to quotes
CREATE OR REPLACE FUNCTION auto_assign_quote_company()
RETURNS trigger AS $$
DECLARE
  user_company_id uuid;
BEGIN
  -- Get user's company
  SELECT company_id INTO user_company_id FROM user_profiles WHERE id = NEW.user_id;
  
  -- Assign company
  IF user_company_id IS NOT NULL THEN
    NEW.company_id := user_company_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-assign company on quote creation
DROP TRIGGER IF EXISTS auto_assign_quote_company_trigger ON quotes;
CREATE TRIGGER auto_assign_quote_company_trigger
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_quote_company();