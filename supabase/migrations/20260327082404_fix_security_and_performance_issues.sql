/*
  # Fix Security and Performance Issues

  1. Performance Fixes
    - Add missing foreign key indexes for `quotes.user_id` and `quote_line_items.quote_id`
    - Optimize RLS policies to use `(select auth.uid())` instead of `auth.uid()`
    - Remove unused indexes (soft delete indexes - not yet used)

  2. Security Fixes
    - Fix function search paths to be immutable
    - Remove SECURITY DEFINER from views
    - Fix audit logs RLS policy to restrict by user_id
    - Recreate views without SECURITY DEFINER

  3. Tables Affected
    - quotes: Add user_id index, update RLS policies
    - quote_line_items: Add quote_id index, update RLS policies
    - user_profiles: Update RLS policies
    - encrypted_api_keys: Update RLS policies
    - audit_logs: Update RLS policies, remove unused indexes
*/

-- Add missing foreign key indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote_id ON quote_line_items(quote_id);

-- Remove unused indexes (soft delete not yet implemented in app)
DROP INDEX IF EXISTS idx_quotes_deleted_at;
DROP INDEX IF EXISTS idx_quote_line_items_deleted_at;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP INDEX IF EXISTS idx_audit_logs_user_id;

-- Drop existing views to recreate without SECURITY DEFINER
DROP VIEW IF EXISTS active_quotes;
DROP VIEW IF EXISTS active_line_items;

-- Recreate views without SECURITY DEFINER
CREATE VIEW active_quotes AS
SELECT * FROM quotes WHERE deleted_at IS NULL;

CREATE VIEW active_line_items AS
SELECT * FROM quote_line_items WHERE deleted_at IS NULL;

-- Fix RLS policies for user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- Fix RLS policies for quotes
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

-- Fix RLS policies for quote_line_items
DROP POLICY IF EXISTS "Users can view own line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can insert own line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can update own line items" ON quote_line_items;
DROP POLICY IF EXISTS "Users can delete own line items" ON quote_line_items;

CREATE POLICY "Users can view own line items"
  ON quote_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_line_items.quote_id 
      AND quotes.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own line items"
  ON quote_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_line_items.quote_id 
      AND quotes.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own line items"
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

CREATE POLICY "Users can delete own line items"
  ON quote_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes 
      WHERE quotes.id = quote_line_items.quote_id 
      AND quotes.user_id = (select auth.uid())
    )
  );

-- Fix RLS policies for encrypted_api_keys
DROP POLICY IF EXISTS "Only owner can view api keys" ON encrypted_api_keys;
DROP POLICY IF EXISTS "Only owner can insert api keys" ON encrypted_api_keys;
DROP POLICY IF EXISTS "Only owner can update api keys" ON encrypted_api_keys;
DROP POLICY IF EXISTS "Only owner can delete api keys" ON encrypted_api_keys;

CREATE POLICY "Only owner can view api keys"
  ON encrypted_api_keys FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.is_owner = true
    )
  );

CREATE POLICY "Only owner can insert api keys"
  ON encrypted_api_keys FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.is_owner = true
    )
  );

CREATE POLICY "Only owner can update api keys"
  ON encrypted_api_keys FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.is_owner = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.is_owner = true
    )
  );

CREATE POLICY "Only owner can delete api keys"
  ON encrypted_api_keys FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.is_owner = true
    )
  );

-- Fix RLS policies for audit_logs
DROP POLICY IF EXISTS "Only owner can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;

CREATE POLICY "Only owner can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.is_owner = true
    )
  );

CREATE POLICY "Users can insert own audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- Fix function search paths (drop trigger first, then function)
DROP TRIGGER IF EXISTS set_owner_on_first_user ON user_profiles;
DROP FUNCTION IF EXISTS set_first_user_as_owner();

CREATE OR REPLACE FUNCTION set_first_user_as_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE is_owner = true) THEN
    NEW.is_owner := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Recreate trigger
CREATE TRIGGER set_owner_on_first_user
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_first_user_as_owner();

-- Fix log_soft_delete function
DROP TRIGGER IF EXISTS log_quote_soft_delete ON quotes;
DROP TRIGGER IF EXISTS log_line_item_soft_delete ON quote_line_items;
DROP FUNCTION IF EXISTS log_soft_delete();

CREATE OR REPLACE FUNCTION log_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    INSERT INTO audit_logs (user_id, table_name, record_id, action, old_data)
    VALUES (
      auth.uid(),
      TG_TABLE_NAME,
      OLD.id,
      'DELETE',
      to_jsonb(OLD)
    );
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    INSERT INTO audit_logs (user_id, table_name, record_id, action, new_data)
    VALUES (
      auth.uid(),
      TG_TABLE_NAME,
      NEW.id,
      'RESTORE',
      to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp;

-- Recreate triggers
CREATE TRIGGER log_quote_soft_delete
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION log_soft_delete();

CREATE TRIGGER log_line_item_soft_delete
  AFTER UPDATE ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION log_soft_delete();
