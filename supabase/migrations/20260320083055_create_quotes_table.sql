/*
  # Create quotes table

  1. New Tables
    - `quotes`
      - `id` (uuid, primary key) - Unique identifier for each quote
      - `reference_name` (text) - User-provided reference name
      - `reference_number` (text) - User-provided reference number
      - `supplier` (text) - Name of the supplier
      - `part_description` (text) - Description of the part
      - `price` (numeric) - Price of the item
      - `lead_time` (text) - Lead time for delivery
      - `contact_person` (text) - Contact person name
      - `file_content` (text) - Content from uploaded file or pasted email
      - `created_at` (timestamptz) - Timestamp of when the quote was created
      
  2. Security
    - Enable RLS on `quotes` table
    - Add policy for authenticated users to read all quotes
    - Add policy for authenticated users to insert quotes
    - Add policy for authenticated users to update their own quotes
    - Add policy for authenticated users to delete their own quotes
*/

CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_name text NOT NULL DEFAULT '',
  reference_number text NOT NULL DEFAULT '',
  supplier text NOT NULL DEFAULT '',
  part_description text NOT NULL DEFAULT '',
  price numeric(10, 2) DEFAULT 0,
  lead_time text DEFAULT '',
  contact_person text DEFAULT '',
  file_content text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all quotes"
  ON quotes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert quotes"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update quotes"
  ON quotes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete quotes"
  ON quotes FOR DELETE
  TO authenticated
  USING (true);