/*
  # Add Missing Line Item Columns

  1. Changes
    - Add `product_code` column to quote_line_items if it doesn't exist (rename from part_number or add new)
    - Add `discount_percent` column to quote_line_items if it doesn't exist
    - Add `net_price` column to quote_line_items if it doesn't exist (rename from total_price or add new)

  2. Notes
    - These columns were defined in the original migration but appear to be missing
    - This migration ensures the table schema matches what the application expects
*/

-- Add product_code column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'product_code'
  ) THEN
    -- Check if part_number exists and rename it, otherwise create new column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'quote_line_items' AND column_name = 'part_number'
    ) THEN
      ALTER TABLE quote_line_items RENAME COLUMN part_number TO product_code;
    ELSE
      ALTER TABLE quote_line_items ADD COLUMN product_code text DEFAULT '';
    END IF;
  END IF;
END $$;

-- Add discount_percent column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'discount_percent'
  ) THEN
    ALTER TABLE quote_line_items ADD COLUMN discount_percent numeric(5, 2) DEFAULT 0;
  END IF;
END $$;

-- Add net_price column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_line_items' AND column_name = 'net_price'
  ) THEN
    -- Check if total_price exists and rename it, otherwise create new column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'quote_line_items' AND column_name = 'total_price'
    ) THEN
      ALTER TABLE quote_line_items RENAME COLUMN total_price TO net_price;
    ELSE
      ALTER TABLE quote_line_items ADD COLUMN net_price numeric(10, 2) NOT NULL DEFAULT 0;
    END IF;
  END IF;
END $$;