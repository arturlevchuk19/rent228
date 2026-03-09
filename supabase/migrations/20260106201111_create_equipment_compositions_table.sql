/*
  # Create Equipment Compositions Table

  1. New Tables
    - `equipment_compositions`
      - `id` (uuid, primary key)
      - `parent_id` (uuid, references equipment_items) - родительское оборудование
      - `child_id` (uuid, references equipment_items) - дочерний элемент
      - `quantity` (integer) - количество единиц дочернего элемента
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `equipment_compositions` table
    - Add policies for authenticated users to manage compositions

  3. Indexes
    - Index on parent_id for fast lookups
    - Index on child_id for fast reverse lookups
    - Unique constraint on (parent_id, child_id) to prevent duplicates
*/

-- Create equipment_compositions table
CREATE TABLE IF NOT EXISTS equipment_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(parent_id, child_id),
  CHECK (parent_id != child_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_equipment_compositions_parent ON equipment_compositions(parent_id);
CREATE INDEX IF NOT EXISTS idx_equipment_compositions_child ON equipment_compositions(child_id);

-- Enable RLS
ALTER TABLE equipment_compositions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view all compositions"
  ON equipment_compositions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert compositions"
  ON equipment_compositions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update compositions"
  ON equipment_compositions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete compositions"
  ON equipment_compositions FOR DELETE
  TO authenticated
  USING (true);