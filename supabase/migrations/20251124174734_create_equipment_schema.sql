/*
  # Create Equipment Management Schema

  ## Overview
  Equipment rental system with categories, items, and inventory tracking

  ## New Tables
  
  ### equipment_categories
  - id (uuid, primary key)
  - name (text) - Category name (e.g., "Звук", "Свет", "Видео")
  - description (text) - Category description
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ### equipment_items
  - id (uuid, primary key)
  - category_id (uuid, foreign key) - Link to category
  - name (text) - Equipment name
  - model (text) - Model/specification
  - serial_number (text) - Serial number (optional)
  - description (text) - Detailed description
  - quantity_total (integer) - Total quantity owned
  - quantity_available (integer) - Currently available quantity
  - rental_price_daily (decimal) - Daily rental price
  - rental_price_weekly (decimal) - Weekly rental price
  - purchase_price (decimal) - Original purchase price
  - purchase_date (date) - When purchased
  - condition (text) - Current condition: excellent, good, fair, needs_repair
  - status (text) - Active, inactive, maintenance, retired
  - notes (text) - Additional notes
  - image_url (text) - Image URL
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Authenticated users can view equipment
  - Only authenticated users can view (create/update via functions later)
*/

-- Create equipment categories table
CREATE TABLE IF NOT EXISTS equipment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create equipment items table
CREATE TABLE IF NOT EXISTS equipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES equipment_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  model text DEFAULT '',
  serial_number text DEFAULT '',
  description text DEFAULT '',
  quantity_total integer NOT NULL DEFAULT 0,
  quantity_available integer NOT NULL DEFAULT 0,
  rental_price_daily decimal(10,2) DEFAULT 0,
  rental_price_weekly decimal(10,2) DEFAULT 0,
  purchase_price decimal(10,2) DEFAULT 0,
  purchase_date date,
  condition text DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'needs_repair')),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance', 'retired')),
  notes text DEFAULT '',
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for equipment_categories
CREATE POLICY "Authenticated users can view categories"
  ON equipment_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert categories"
  ON equipment_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
  ON equipment_categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete categories"
  ON equipment_categories FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for equipment_items
CREATE POLICY "Authenticated users can view equipment"
  ON equipment_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert equipment"
  ON equipment_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update equipment"
  ON equipment_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete equipment"
  ON equipment_items FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_equipment_items_category ON equipment_items(category_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_status ON equipment_items(status);
CREATE INDEX IF NOT EXISTS idx_equipment_items_name ON equipment_items(name);

-- Insert default categories
INSERT INTO equipment_categories (name, description) VALUES
  ('Звук', 'Звуковое оборудование: микрофоны, колонки, микшеры'),
  ('Свет', 'Световое оборудование: прожекторы, LED панели, контроллеры'),
  ('Видео', 'Видеооборудование: камеры, проекторы, экраны'),
  ('Сцена', 'Сценические конструкции: подиумы, декорации'),
  ('Прочее', 'Другое оборудование')
ON CONFLICT DO NOTHING;
