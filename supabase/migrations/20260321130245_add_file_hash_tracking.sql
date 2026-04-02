/*
  # Add File Hash Tracking and Duplicate Detection

  1. Changes to `quotes` table
    - Add `file_hash` column to track unique file uploads
    - Add `file_name` column to store original filename
    - Add index on file_hash for fast duplicate detection

  2. Security
    - No changes to existing RLS policies
*/

-- Add file tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'file_hash'
  ) THEN
    ALTER TABLE quotes ADD COLUMN file_hash text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE quotes ADD COLUMN file_name text;
  END IF;
END $$;

-- Add index for fast duplicate file detection
CREATE INDEX IF NOT EXISTS idx_quotes_file_hash ON quotes(file_hash) WHERE file_hash IS NOT NULL;

-- Add index for similar description search
CREATE INDEX IF NOT EXISTS idx_line_items_description ON quote_line_items USING gin(to_tsvector('english', description));