/*
  # Add missing columns to quotes table
  
  1. Changes
    - Add `file_name` column to store uploaded file names
    - Add `quote_date` column to store quote dates
    - Add `quote_reference` column to store supplier quote references
    - Add `total_net_amount` column for net total
    - Add `total_vat_amount` column for VAT amount
    - Add `order_total` column for order total
    - Add `supplier_contact_name` column for supplier contact
    - Add `supplier_email` column for supplier email
    - Add `supplier_phone` column for supplier phone
    - Add `generated_part_number` column for auto-generated part numbers
  
  2. Indexes
    - Add indexes for commonly queried columns
  
  3. Security
    - No RLS changes needed
*/

-- Add missing columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'file_name') THEN
    ALTER TABLE quotes ADD COLUMN file_name text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'quote_date') THEN
    ALTER TABLE quotes ADD COLUMN quote_date timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'quote_reference') THEN
    ALTER TABLE quotes ADD COLUMN quote_reference text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'total_net_amount') THEN
    ALTER TABLE quotes ADD COLUMN total_net_amount numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'total_vat_amount') THEN
    ALTER TABLE quotes ADD COLUMN total_vat_amount numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'order_total') THEN
    ALTER TABLE quotes ADD COLUMN order_total numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'supplier_contact_name') THEN
    ALTER TABLE quotes ADD COLUMN supplier_contact_name text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'supplier_email') THEN
    ALTER TABLE quotes ADD COLUMN supplier_email text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'supplier_phone') THEN
    ALTER TABLE quotes ADD COLUMN supplier_phone text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'generated_part_number') THEN
    ALTER TABLE quotes ADD COLUMN generated_part_number text;
  END IF;
END $$;

-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_quotes_quote_date ON quotes(quote_date) WHERE quote_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_file_name ON quotes(file_name) WHERE file_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_reference_number ON quotes(reference_number) WHERE reference_number IS NOT NULL;
