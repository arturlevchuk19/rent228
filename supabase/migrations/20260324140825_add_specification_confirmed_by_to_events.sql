/*
  # Add specification_confirmed_by column to events

  Adds the missing `specification_confirmed_by` uuid column to the events table,
  referencing auth.users. Also ensures specification_confirmed and specification_confirmed_at exist.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS specification_confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS specification_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS specification_confirmed_by uuid REFERENCES auth.users(id);
