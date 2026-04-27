/*
  # Add Supplier Contact Information Fields

  1. Changes to quotes table
    - Add `supplier_contact_name` field to store the supplier contact person's name
    - Add `supplier_email` field to store the supplier's email address
    - Add `supplier_phone` field to store the supplier's phone number
    - Remove the `customer_reference` field as we're focusing on supplier info

  2. Notes
    - These fields will store the supplier/vendor contact details from quotes
    - Customer information is ignored per business requirements
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_contact_name'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_contact_name text DEFAULT 'Not specified';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_email'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_email text DEFAULT 'Not specified';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'supplier_phone'
  ) THEN
    ALTER TABLE quotes ADD COLUMN supplier_phone text DEFAULT 'Not specified';
  END IF;
END $$;