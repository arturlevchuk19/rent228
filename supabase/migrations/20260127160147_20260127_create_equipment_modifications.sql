/*
  # Create equipment modifications system

  1. New Tables
    - `equipment_modifications`
      - `id` (uuid, primary key)
      - `equipment_id` (uuid, references equipment_items)
      - `name` (text) - e.g., "на стойках", "в подвесе"
      - `description` (text, optional)
      - `sort_order` (integer)
      - `created_at` (timestamp)
    
    - `modification_components`
      - `id` (uuid, primary key)
      - `modification_id` (uuid, references equipment_modifications)
      - `component_equipment_id` (uuid, references equipment_items)
      - `quantity` (integer)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users

  3. Relationships
    - equipment_modifications references equipment_items
    - modification_components references equipment_modifications and equipment_items
    - When selecting equipment with modifications, include all components in warehouse specification
*/

CREATE TABLE IF NOT EXISTS equipment_modifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT ''::text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modification_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modification_id uuid NOT NULL REFERENCES equipment_modifications(id) ON DELETE CASCADE,
  component_equipment_id uuid NOT NULL REFERENCES equipment_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE modification_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view equipment modifications"
  ON equipment_modifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view modification components"
  ON modification_components FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage equipment modifications"
  ON equipment_modifications FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'superuser')
    )
  ));

CREATE POLICY "Admin can update equipment modifications"
  ON equipment_modifications FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  ));

CREATE POLICY "Admin can delete equipment modifications"
  ON equipment_modifications FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  ));

CREATE POLICY "Admin can manage modification components"
  ON modification_components FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  ));

CREATE POLICY "Admin can update modification components"
  ON modification_components FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  ));

CREATE POLICY "Admin can delete modification components"
  ON modification_components FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  ));

CREATE INDEX IF NOT EXISTS equipment_modifications_equipment_id_idx ON equipment_modifications(equipment_id);
CREATE INDEX IF NOT EXISTS modification_components_modification_id_idx ON modification_components(modification_id);
CREATE INDEX IF NOT EXISTS modification_components_component_id_idx ON modification_components(component_equipment_id);
