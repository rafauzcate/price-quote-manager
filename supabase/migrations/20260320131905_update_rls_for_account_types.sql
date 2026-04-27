/*
  # Update RLS Policies for Single and Company Users

  ## Overview
  Updates Row Level Security policies to support two account types:
  - Single users: Access only their own data
  - Company users: Access data from their company

  ## Changes
  1. Update quotes table policies
  2. Update quote_line_items table policies
  3. Ensure single users have isolated workspaces
  4. Ensure company users share data within their company

  ## Security
  - Single users can only see their own quotes
  - Company users can see all quotes from their company
  - Proper isolation between single users and companies
*/

-- Drop existing policies for quotes
DROP POLICY IF EXISTS "Users can view their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON quotes;

-- Create new policies for quotes that support both account types

-- SELECT: Users can view quotes based on account type
CREATE POLICY "Users can view their quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR
    (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = (SELECT auth.uid())
      AND account_type = 'company'
    ) = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = quotes.user_id
    )
  );

-- INSERT: Users can insert quotes
CREATE POLICY "Users can insert quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- UPDATE: Users can update their own quotes
CREATE POLICY "Users can update their quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR
    (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = (SELECT auth.uid())
      AND account_type = 'company'
    ) = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = quotes.user_id
    )
  )
  WITH CHECK (user_id = (SELECT auth.uid()));

-- DELETE: Users can delete quotes based on account type
CREATE POLICY "Users can delete their quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR
    (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = (SELECT auth.uid())
      AND account_type = 'company'
    ) = (
      SELECT company_id 
      FROM user_profiles 
      WHERE id = quotes.user_id
    )
  );

-- Drop existing policies for quote_line_items
DROP POLICY IF EXISTS "Users can view line items for their quotes" ON quote_line_items;
DROP POLICY IF EXISTS "Users can insert line items for their quotes" ON quote_line_items;
DROP POLICY IF EXISTS "Users can update line items for their quotes" ON quote_line_items;
DROP POLICY IF EXISTS "Users can delete line items for their quotes" ON quote_line_items;

-- Create new policies for quote_line_items

-- SELECT: Users can view line items for their quotes
CREATE POLICY "Users can view their line items"
  ON quote_line_items FOR SELECT
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE user_id = (SELECT auth.uid())
      OR (
        SELECT company_id 
        FROM user_profiles 
        WHERE id = (SELECT auth.uid())
        AND account_type = 'company'
      ) = (
        SELECT company_id 
        FROM user_profiles 
        WHERE id = quotes.user_id
      )
    )
  );

-- INSERT: Users can insert line items for their quotes
CREATE POLICY "Users can insert their line items"
  ON quote_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- UPDATE: Users can update line items for their quotes
CREATE POLICY "Users can update their line items"
  ON quote_line_items FOR UPDATE
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE user_id = (SELECT auth.uid())
      OR (
        SELECT company_id 
        FROM user_profiles 
        WHERE id = (SELECT auth.uid())
        AND account_type = 'company'
      ) = (
        SELECT company_id 
        FROM user_profiles 
        WHERE id = quotes.user_id
      )
    )
  )
  WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- DELETE: Users can delete line items for their quotes
CREATE POLICY "Users can delete their line items"
  ON quote_line_items FOR DELETE
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE user_id = (SELECT auth.uid())
      OR (
        SELECT company_id 
        FROM user_profiles 
        WHERE id = (SELECT auth.uid())
        AND account_type = 'company'
      ) = (
        SELECT company_id 
        FROM user_profiles 
        WHERE id = quotes.user_id
      )
    )
  );