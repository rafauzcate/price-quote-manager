/*
  # Add Trial Tracking to User Profiles

  ## Overview
  Adds signup_date tracking to user_profiles table to support 30-day free trial functionality.

  ## Changes
  1. Add signup_date column to user_profiles table
     - Tracks when user first signed up
     - Defaults to now() for new users
     - Backfills existing users with created_at value

  ## Security
  - Maintains existing RLS policies
  - Users can only view/update their own signup_date
*/

-- Add signup_date column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'signup_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN signup_date timestamptz DEFAULT now();
    
    -- Backfill existing users with their created_at value
    UPDATE user_profiles SET signup_date = created_at WHERE signup_date IS NULL;
  END IF;
END $$;