/*
  # Create Warehouse Specification Items Schema

  1. New Tables
    - `warehouse_specification_cables`
      - `id` (uuid, primary key)
      - `event_id` (uuid, references events)
      - `cable_type` (text) - тип кабеля (POWERCON, DMX, XLR, SCREEN, Удлинители)
      - `cable_length` (text) - длина кабеля (1м, 2м, 5м, и т.д.)
      - `quantity` (integer) - количество
      - `notes` (text) - примечания
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `warehouse_specification_connectors`
      - `id` (uuid, primary key)
      - `event_id` (uuid, references events)
      - `connector_type` (text) - тип коннектора (Сплиттер X6, Карабулька X2, Состыковка)
      - `quantity` (integer) - количество
      - `notes` (text) - примечания
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their specification items

  3. Indexes
    - Index on event_id for fast lookups
    - Index on cable_type and connector_type for filtering
*/

-- Create warehouse_specification_cables table
CREATE TABLE IF NOT EXISTS warehouse_specification_cables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  cable_type text NOT NULL,
  cable_length text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create warehouse_specification_connectors table
CREATE TABLE IF NOT EXISTS warehouse_specification_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  connector_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_cables_event ON warehouse_specification_cables(event_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_cables_type ON warehouse_specification_cables(cable_type);
CREATE INDEX IF NOT EXISTS idx_warehouse_connectors_event ON warehouse_specification_connectors(event_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_connectors_type ON warehouse_specification_connectors(connector_type);

-- Enable RLS
ALTER TABLE warehouse_specification_cables ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_specification_connectors ENABLE ROW LEVEL SECURITY;

-- Create policies for cables
CREATE POLICY "Authenticated users can view all cables"
  ON warehouse_specification_cables FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cables"
  ON warehouse_specification_cables FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cables"
  ON warehouse_specification_cables FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete cables"
  ON warehouse_specification_cables FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for connectors
CREATE POLICY "Authenticated users can view all connectors"
  ON warehouse_specification_connectors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert connectors"
  ON warehouse_specification_connectors FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update connectors"
  ON warehouse_specification_connectors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete connectors"
  ON warehouse_specification_connectors FOR DELETE
  TO authenticated
  USING (true);
