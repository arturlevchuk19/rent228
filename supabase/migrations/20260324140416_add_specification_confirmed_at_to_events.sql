
/*
  # Add specification_confirmed_at column to events

  Adds the missing `specification_confirmed_at` timestamp column to the events table.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'specification_confirmed_at'
  ) THEN
    ALTER TABLE events ADD COLUMN specification_confirmed_at timestamptz;
  END IF;
END $$;
