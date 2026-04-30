/*
  # Create equipment type and subtype directories

  1. New Tables
    - `equipment_types`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `equipment_subtypes`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS and CRUD policies for authenticated users

  3. Initial Data
    - Fill directories from distinct values in equipment_items.type and equipment_items.subtype
*/

CREATE TABLE IF NOT EXISTS equipment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment_subtypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_subtypes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read equipment_types"
  ON equipment_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert equipment_types"
  ON equipment_types FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update equipment_types"
  ON equipment_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete equipment_types"
  ON equipment_types FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read equipment_subtypes"
  ON equipment_subtypes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert equipment_subtypes"
  ON equipment_subtypes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update equipment_subtypes"
  ON equipment_subtypes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete equipment_subtypes"
  ON equipment_subtypes FOR DELETE TO authenticated USING (true);

INSERT INTO equipment_types (name)
SELECT DISTINCT trim(type)
FROM equipment_items
WHERE trim(coalesce(type, '')) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO equipment_subtypes (name)
SELECT DISTINCT trim(subtype)
FROM equipment_items
WHERE trim(coalesce(subtype, '')) <> ''
ON CONFLICT (name) DO NOTHING;
