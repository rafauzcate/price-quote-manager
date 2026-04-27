/*
  # Add file_hash column to quotes table
  
  1. Changes
    - Add `file_hash` column to `quotes` table for duplicate detection
    - Create index on `file_hash` for efficient lookups
  
  2. Security
    - No RLS changes needed
*/

-- Add file_hash column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'file_hash'
  ) THEN
    ALTER TABLE quotes ADD COLUMN file_hash text;
  END IF;
END $$;

-- Create index for efficient duplicate detection
CREATE INDEX IF NOT EXISTS idx_quotes_file_hash ON quotes(file_hash) WHERE file_hash IS NOT NULL;
