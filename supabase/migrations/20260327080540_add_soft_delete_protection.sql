/*
  # Add Soft Delete Protection and Audit Trail

  1. Changes
    - Add `deleted_at` timestamp to quotes and quote_line_items tables for soft deletes
    - Create audit log table to track all data modifications
    - Add trigger to log deletions
    - Create view to show only active (non-deleted) records
  
  2. Benefits
    - Data is never permanently lost (soft delete)
    - Full audit trail of who deleted what and when
    - Easy recovery of accidentally deleted data
    - Owner can review and permanently delete if needed

  3. Security
    - Audit logs are append-only
    - Only owner can see deleted records
    - Users can only soft-delete their own data
*/

-- Add soft delete columns
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'RESTORE')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only owner can view audit logs
CREATE POLICY "Only owner can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.is_owner = true
    )
  );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to log soft deletions
CREATE OR REPLACE FUNCTION log_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    INSERT INTO audit_logs (user_id, table_name, record_id, action, old_data)
    VALUES (
      auth.uid(),
      TG_TABLE_NAME,
      OLD.id,
      'DELETE',
      to_jsonb(OLD)
    );
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
    INSERT INTO audit_logs (user_id, table_name, record_id, action, new_data)
    VALUES (
      auth.uid(),
      TG_TABLE_NAME,
      NEW.id,
      'RESTORE',
      to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add triggers for soft delete logging
DROP TRIGGER IF EXISTS log_quote_soft_delete ON quotes;
CREATE TRIGGER log_quote_soft_delete
  AFTER UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION log_soft_delete();

DROP TRIGGER IF EXISTS log_line_item_soft_delete ON quote_line_items;
CREATE TRIGGER log_line_item_soft_delete
  AFTER UPDATE ON quote_line_items
  FOR EACH ROW
  EXECUTE FUNCTION log_soft_delete();

-- Create views for active records (non-deleted)
CREATE OR REPLACE VIEW active_quotes AS
SELECT * FROM quotes WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW active_line_items AS
SELECT * FROM quote_line_items WHERE deleted_at IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quotes_deleted_at ON quotes(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_quote_line_items_deleted_at ON quote_line_items(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
