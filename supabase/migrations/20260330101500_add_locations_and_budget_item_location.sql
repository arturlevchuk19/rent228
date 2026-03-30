/*
  # Add event locations and link budget items to locations

  1. New table
    - `locations`
      - `id` (uuid, primary key)
      - `event_id` (uuid, not null, FK to events)
      - `name` (text, not null)
      - `color` (text, not null, default '#6B7280')
      - `sort_order` (integer, not null, default 0)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Changes to existing table
    - `budget_items.location_id` (uuid, nullable, FK to locations)

  3. Performance
    - indexes on `locations.event_id`, `budget_items.event_id`, and `budget_items.location_id`
*/

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'locations'
      AND policyname = 'Users can view locations for all events'
  ) THEN
    CREATE POLICY "Users can view locations for all events"
      ON locations
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'locations'
      AND policyname = 'Users can insert locations for events'
  ) THEN
    CREATE POLICY "Users can insert locations for events"
      ON locations
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'locations'
      AND policyname = 'Users can update locations for events'
  ) THEN
    CREATE POLICY "Users can update locations for events"
      ON locations
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'locations'
      AND policyname = 'Users can delete locations for events'
  ) THEN
    CREATE POLICY "Users can delete locations for events"
      ON locations
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE budget_items
      ADD COLUMN location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_locations_event_id ON locations(event_id);
CREATE INDEX IF NOT EXISTS idx_locations_event_sort_order ON locations(event_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_budget_items_event_id ON budget_items(event_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_location_id ON budget_items(location_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_event_location_id ON budget_items(event_id, location_id);
