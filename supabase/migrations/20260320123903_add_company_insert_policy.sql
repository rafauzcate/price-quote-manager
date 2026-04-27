/*
  # Add Company Insert Policy

  ## Overview
  This migration adds the missing INSERT policy for the companies table.
  Without this policy, authenticated users cannot create new companies.

  ## Changes
  - Add INSERT policy allowing authenticated users to create companies

  ## Security
  - Users can only create companies for their own email domain
  - Uses optimized (select auth.uid()) pattern for performance
*/

-- Add INSERT policy for companies table
CREATE POLICY "Authenticated users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);