/*
  # Add event_id to categories table

  ## Summary
  Adds an optional `event_id` column to the `categories` table to support
  event-scoped categories (created when applying templates to events).

  ## Changes
  - `categories` table: add `event_id` column (uuid, nullable, FK to events)
  - Remove UNIQUE constraint on `name` to allow same name per different events

  ## Notes
  - Global/reusable categories have `event_id = NULL`
  - Categories created by applying a template to an event have `event_id` set
  - This allows filtering: global categories for the dropdown, event categories for display
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN event_id uuid REFERENCES events(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'categories' AND constraint_name = 'categories_name_key' AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE categories DROP CONSTRAINT categories_name_key;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_event_id ON categories(event_id);
