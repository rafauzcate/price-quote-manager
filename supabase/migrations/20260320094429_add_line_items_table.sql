/*
  # Add Line Items Table for Quotes

  1. New Tables
    - `quote_line_items`
      - `id` (uuid, primary key)
      - `quote_id` (uuid, foreign key to quotes table)
      - `product_code` (text) - The product/item code
      - `description` (text) - Description of the item
      - `quantity` (numeric) - Quantity ordered
      - `unit_price` (numeric) - Price per unit
      - `discount_percent` (numeric) - Discount percentage applied
      - `net_price` (numeric) - Total price after discount
      - `created_at` (timestamp)

  2. Changes
    - Add `quote_date` field to quotes table
    - Add `quote_reference` field to quotes table
    - Add `customer_reference` field to quotes table
    - Add `total_net_amount` field to quotes table
    - Add `total_vat_amount` field to quotes table
    - Add `order_total` field to quotes table

  3. Security
    - Enable RLS on `quote_line_items` table
    - Add policies for authenticated users to manage their own quote line items
*/

-- Add new fields to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'quote_date'
  ) THEN
    ALTER TABLE quotes ADD COLUMN quote_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'quote_reference'
  ) THEN
    ALTER TABLE quotes ADD COLUMN quote_reference text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'customer_reference'
  ) THEN
    ALTER TABLE quotes ADD COLUMN customer_reference text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'total_net_amount'
  ) THEN
    ALTER TABLE quotes ADD COLUMN total_net_amount numeric(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'total_vat_amount'
  ) THEN
    ALTER TABLE quotes ADD COLUMN total_vat_amount numeric(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'order_total'
  ) THEN
    ALTER TABLE quotes ADD COLUMN order_total numeric(10, 2);
  END IF;
END $$;

-- Create quote_line_items table
CREATE TABLE IF NOT EXISTS quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_code text DEFAULT '',
  description text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 0,
  unit_price numeric(10, 2) NOT NULL DEFAULT 0,
  discount_percent numeric(5, 2) DEFAULT 0,
  net_price numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;

-- Policies for quote_line_items
CREATE POLICY "Users can view own quote line items"
  ON quote_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own quote line items"
  ON quote_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own quote line items"
  ON quote_line_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own quote line items"
  ON quote_line_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_line_items.quote_id
      AND quotes.user_id = auth.uid()
    )
  );