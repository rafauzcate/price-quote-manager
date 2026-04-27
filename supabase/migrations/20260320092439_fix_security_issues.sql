/*
  # Fix Security Issues

  1. Changes
    - Remove unused index `idx_quotes_generated_part_number`
    - Add `user_id` column to track quote ownership
    - Drop existing overly permissive RLS policies
    - Create proper restrictive RLS policies based on user ownership
  
  2. Security Improvements
    - Users can only view their own quotes
    - Users can only insert quotes with their own user_id
    - Users can only update their own quotes
    - Users can only delete their own quotes
  
  3. Notes
    - The user_id will be automatically set to the authenticated user's ID
    - All existing quotes will need to be re-assigned or deleted
    - This ensures proper data isolation between users
*/

-- Remove unused index
DROP INDEX IF EXISTS idx_quotes_generated_part_number;

-- Add user_id column to track ownership
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view all quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete quotes" ON quotes;

-- Create properly restrictive policies

-- Users can only view their own quotes
CREATE POLICY "Users can view own quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can only insert quotes with their own user_id
CREATE POLICY "Users can insert own quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own quotes
CREATE POLICY "Users can update own quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own quotes
CREATE POLICY "Users can delete own quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
