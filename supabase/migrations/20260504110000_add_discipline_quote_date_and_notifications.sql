/*
  # Add quote discipline, normalize quote_date, and notification persistence

  1. Quotes updates
    - Create quote_discipline enum (Electrical, Mechanical, Structural, Civil, ICA)
    - Add nullable discipline column to quotes
    - Normalize quote_date to DATE type where needed
    - Backfill quote_date for legacy rows from created_at
    - Add indexes for discipline and quote_date

  2. Notifications updates
    - If notifications table exists, add read_at/dismissed_at columns
    - If not, create notifications table with RLS for per-user persistence
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'quote_discipline'
  ) THEN
    CREATE TYPE quote_discipline AS ENUM ('Electrical', 'Mechanical', 'Structural', 'Civil', 'ICA');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'discipline'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN discipline quote_discipline;
  END IF;
END $$;

DO $$
DECLARE
  quote_date_type text;
BEGIN
  SELECT data_type
  INTO quote_date_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'quote_date';

  IF quote_date_type IS NULL THEN
    ALTER TABLE public.quotes ADD COLUMN quote_date date;
  ELSIF quote_date_type <> 'date' THEN
    ALTER TABLE public.quotes
      ALTER COLUMN quote_date TYPE date
      USING quote_date::date;
  END IF;
END $$;

UPDATE public.quotes
SET quote_date = created_at::date
WHERE quote_date IS NULL
  AND created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_discipline ON public.quotes (discipline) WHERE discipline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_quote_date_date ON public.quotes (quote_date) WHERE quote_date IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'read_at'
    ) THEN
      ALTER TABLE public.notifications ADD COLUMN read_at timestamptz;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'dismissed_at'
    ) THEN
      ALTER TABLE public.notifications ADD COLUMN dismissed_at timestamptz;
    END IF;
  ELSE
    CREATE TABLE public.notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text NOT NULL DEFAULT '',
      type text NOT NULL DEFAULT 'info',
      created_at timestamptz NOT NULL DEFAULT now(),
      read_at timestamptz,
      dismissed_at timestamptz
    );

    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view own notifications"
      ON public.notifications FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert own notifications"
      ON public.notifications FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can update own notifications"
      ON public.notifications FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "Users can delete own notifications"
      ON public.notifications FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at ON public.notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_dismissed_at ON public.notifications (user_id, dismissed_at);
