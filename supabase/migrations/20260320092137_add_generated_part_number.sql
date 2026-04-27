/*
  # Add Generated Part Number Column

  1. Changes
    - Add `generated_part_number` column to `quotes` table
      - Type: text
      - Position: After `id` column
      - Indexed for fast searching
      - Not nullable to ensure every quote has a part number
  
  2. Notes
    - This column will store auto-generated part numbers in format: REFERENCE-01, REFERENCE-02, etc.
    - Indexed to optimize search performance
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'generated_part_number'
  ) THEN
    ALTER TABLE quotes ADD COLUMN generated_part_number text NOT NULL DEFAULT '';
    CREATE INDEX IF NOT EXISTS idx_quotes_generated_part_number ON quotes(generated_part_number);
  END IF;
END $$;
