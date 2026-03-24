
/*
  # Add specification_confirmed column to events

  Adds the missing `specification_confirmed` boolean column to the events table.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'specification_confirmed'
  ) THEN
    ALTER TABLE events ADD COLUMN specification_confirmed boolean DEFAULT false;
  END IF;
END $$;
