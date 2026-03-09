/*
  # Update Events Management Schema

  ## Overview
  Update existing tables to match requirements for events management system

  ## Changes
  
  ### Update clients table
  - Add organization field (rename name to organization)
  - Add full_name field (rename contact_person)
  - Add position field
  - Keep phone, email, notes

  ### Create organizers table
  - New table for coordinators
  
  ### Update events table
  - Add event_type field
  - Add budget field
  - Add specification field
  - Update status values
  - Add organizer_id foreign key
  - Add progress tracking fields
  
  ### Update venues table
  - Add contact, capacity, description fields

  ## Security
  - All tables already have RLS enabled
*/

-- First, update clients table structure
DO $$
BEGIN
  -- Rename name column to organization if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'name'
  ) THEN
    ALTER TABLE clients RENAME COLUMN name TO organization;
  END IF;

  -- Rename contact_person to full_name if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE clients RENAME COLUMN contact_person TO full_name;
  END IF;

  -- Add position column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'position'
  ) THEN
    ALTER TABLE clients ADD COLUMN position text DEFAULT '';
  END IF;
END $$;

-- Update venues table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'venues' AND column_name = 'contact'
  ) THEN
    ALTER TABLE venues ADD COLUMN contact text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'venues' AND column_name = 'capacity'
  ) THEN
    ALTER TABLE venues ADD COLUMN capacity integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'venues' AND column_name = 'description'
  ) THEN
    ALTER TABLE venues ADD COLUMN description text DEFAULT '';
  END IF;
END $$;

-- Create organizers table
CREATE TABLE IF NOT EXISTS organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  position text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizers_full_name ON organizers(full_name);

-- Enable RLS for organizers
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizers
CREATE POLICY "Authenticated users can view organizers"
  ON organizers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert organizers"
  ON organizers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update organizers"
  ON organizers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete organizers"
  ON organizers FOR DELETE
  TO authenticated
  USING (true);

-- Update events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE events ADD COLUMN event_type text DEFAULT 'Концерт';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'budget'
  ) THEN
    ALTER TABLE events ADD COLUMN budget text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'specification'
  ) THEN
    ALTER TABLE events ADD COLUMN specification text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'organizer_id'
  ) THEN
    ALTER TABLE events ADD COLUMN organizer_id uuid REFERENCES organizers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'progress_budget_done'
  ) THEN
    ALTER TABLE events ADD COLUMN progress_budget_done boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'progress_equipment_reserved'
  ) THEN
    ALTER TABLE events ADD COLUMN progress_equipment_reserved boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'progress_project_completed'
  ) THEN
    ALTER TABLE events ADD COLUMN progress_project_completed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'progress_paid'
  ) THEN
    ALTER TABLE events ADD COLUMN progress_paid boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for events
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);
