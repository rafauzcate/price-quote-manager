/*
  # Remove company_id from quotes table

  ## Overview
  Removes the unused company_id column from the quotes table since we've reverted to single-user mode.

  ## Changes
  1. Drop company_id column from quotes table
  
  ## Security
  - No RLS changes needed
  - Maintains existing single-user policies
*/

-- Remove company_id column from quotes table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE quotes DROP COLUMN company_id;
  END IF;
END $$;
