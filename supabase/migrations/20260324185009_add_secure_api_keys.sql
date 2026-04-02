/*
  # Add Secure API Key Storage

  1. New Tables
    - `user_api_keys`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `openai_api_key_encrypted` (text) - Encrypted API key
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `last_used_at` (timestamptz)

  2. Security
    - Enable RLS on `user_api_keys` table
    - Users can only read/write their own API keys
    - API keys are stored encrypted (frontend sends encrypted)
    
  3. Performance
    - Index on user_id for fast lookups
    - Unique constraint on user_id (one API key per user)
*/

CREATE TABLE IF NOT EXISTS user_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  openai_api_key_encrypted text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE(user_id)
);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API key"
  ON user_api_keys FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own API key"
  ON user_api_keys FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own API key"
  ON user_api_keys FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own API key"
  ON user_api_keys FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id 
  ON user_api_keys(user_id);