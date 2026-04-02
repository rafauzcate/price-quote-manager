/*
  # Add Quote Expiry and Price Update Tracking

  1. Changes to Tables
    - `quotes`
      - Add `expires_at` (timestamptz) - Date when quote becomes outdated (6 months from created_at)
      - Add `is_expired_notified` (boolean) - Whether user has been notified about expiry
      - Add `last_price_check` (timestamptz) - Last time we checked for updated prices
      - Add `online_price_found` (numeric) - Latest price found online (if any)
      - Add `online_price_source` (text) - Source URL where price was found
      - Add `online_price_checked_at` (timestamptz) - When online price was last checked

  2. Functions
    - Create function to automatically set expires_at on insert
    - Create function to get expired quotes for a user

  3. Indexes
    - Index on expires_at for efficient expired quote queries
*/

-- Add new columns to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '6 months');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'is_expired_notified'
  ) THEN
    ALTER TABLE quotes ADD COLUMN is_expired_notified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'last_price_check'
  ) THEN
    ALTER TABLE quotes ADD COLUMN last_price_check timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'online_price_found'
  ) THEN
    ALTER TABLE quotes ADD COLUMN online_price_found numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'online_price_source'
  ) THEN
    ALTER TABLE quotes ADD COLUMN online_price_source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'online_price_checked_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN online_price_checked_at timestamptz;
  END IF;
END $$;

-- Update existing quotes to have expires_at set
UPDATE quotes 
SET expires_at = created_at + interval '6 months'
WHERE expires_at IS NULL;

-- Create index for efficient expired quote queries
CREATE INDEX IF NOT EXISTS idx_quotes_expires_at 
  ON quotes(user_id, expires_at) 
  WHERE expires_at IS NOT NULL;

-- Function to automatically set expires_at on new quotes
CREATE OR REPLACE FUNCTION set_quote_expiry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.created_at + interval '6 months';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set expiry on insert
DROP TRIGGER IF EXISTS trigger_set_quote_expiry ON quotes;
CREATE TRIGGER trigger_set_quote_expiry
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION set_quote_expiry();

-- Function to get expired quotes for a user
CREATE OR REPLACE FUNCTION get_expired_quotes(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  reference_name text,
  supplier text,
  expires_at timestamptz,
  days_expired integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.reference_name,
    q.supplier,
    q.expires_at,
    EXTRACT(DAY FROM (now() - q.expires_at))::integer as days_expired
  FROM quotes q
  WHERE q.user_id = p_user_id
    AND q.expires_at < now()
    AND q.is_expired_notified = false
  ORDER BY q.expires_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;