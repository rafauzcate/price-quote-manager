/*
  # Fix User Profile Access

  ## Overview
  Adds policy to allow users to view their own profile even without a company.

  ## Changes
  1. Add policy for users to view their own profile
  
  ## Security
  - Users can always view their own profile data
  - Maintains existing company-based access for viewing other profiles
*/

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));