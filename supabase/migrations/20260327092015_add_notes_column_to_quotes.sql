/*
  # Add notes column to quotes table
  
  1. Changes
    - Add `notes` column to store user notes for quotes
  
  2. Security
    - No RLS changes needed
*/

-- Add notes column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'notes') THEN
    ALTER TABLE quotes ADD COLUMN notes text DEFAULT '';
  END IF;
END $$;
