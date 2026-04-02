/*
  # Add Missing User Profile Columns

  1. Changes
    - Add `company` column to store company name
    - Add `signup_date` column to track when user signed up
    - Backfill signup_date from created_at for existing users

  2. Notes
    - Company defaults to empty string
    - Signup_date defaults to created_at for existing records
*/

-- Add company column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'company'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN company text DEFAULT '';
  END IF;
END $$;

-- Add signup_date column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'signup_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN signup_date timestamptz DEFAULT now();
  END IF;
END $$;

-- Backfill signup_date from created_at for existing users where signup_date is null
UPDATE user_profiles
SET signup_date = created_at
WHERE signup_date IS NULL;