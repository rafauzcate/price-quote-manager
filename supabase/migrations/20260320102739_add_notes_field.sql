/*
  # Add notes field to quotes table

  1. Changes
    - Add `notes` column to `quotes` table
      - `notes` (text, nullable) - User notes about the quote
  
  2. Notes
    - This field allows users to add brief descriptions or relevant notes regarding a quote
    - The field is optional and can be left empty
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'notes'
  ) THEN
    ALTER TABLE quotes ADD COLUMN notes text;
  END IF;
END $$;
