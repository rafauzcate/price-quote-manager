/*
  # Fix Performance and Security Issues

  1. Performance Improvements
    - Add indexes on foreign key columns for better query performance
    - Optimize RLS policies to use `(select auth.uid())` instead of `auth.uid()`
    
  2. Indexes Added
    - `quote_line_items.quote_id` - Foreign key to quotes table
    - `quotes.user_id` - Foreign key to auth.users table
    
  3. RLS Policy Optimizations
    - Update all policies on `quotes` table to use `(select auth.uid())`
    - Update all policies on `quote_line_items` table to use `(select auth.uid())`
    - This prevents re-evaluation of auth function for each row
    
  4. Notes
    - Indexes improve JOIN and WHERE clause performance
    - Optimized RLS policies reduce query execution time at scale
*/

-- Add indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_id 
  ON quote_line_items(quote_id);

CREATE INDEX IF NOT EXISTS idx_quotes_user_id 
  ON quotes(user_id);

-- Drop and recreate optimized policies for quotes table
DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;

CREATE POLICY "Users can view own quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Drop and recreate optimized policies for quote_line_items table
DROP POLICY IF EXISTS "Users can view own quote line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can insert own quote line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can update own quote line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can delete own quote line items" ON quote_line_items;

CREATE POLICY "Users can view own quote line items"
  ON quote_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own quote line items"
  ON quote_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own quote line items"
  ON quote_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own quote line items"
  ON quote_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = (select auth.uid())
    )
  );