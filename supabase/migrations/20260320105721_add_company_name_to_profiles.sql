/*
  # Add Company Name to User Profiles

  1. Schema Changes
    - Add `company` column to `user_profiles` table
      - Type: text
      - Nullable: true (optional field)
      - Default: empty string
  
  2. Important Notes
    - Existing user profiles will have empty company name by default
    - Users can update their company name through the profile UI
*/

-- Add company column to user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'company'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN company text DEFAULT '';
  END IF;
END $$;