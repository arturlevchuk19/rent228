/*
  # Update Equipment Schema to Match CSV Structure

  ## Overview
  Restructure equipment tables to match the real equipment catalog CSV format

  ## Changes
  
  ### Drop old tables
  - Drop equipment_items and equipment_categories tables
  
  ### New Tables
  
  #### equipment_items
  - id (uuid, primary key)
  - category (text) - Main category: Видео, Звук, Кабель, Сцена, Свет, Связь, Спецэффекты, Электроснабжение, Коннектор, Прочее
  - type (text) - Type: Оборудование, Крепление, Стойка, etc.
  - subtype (text) - Subtype: specific equipment type
  - name (text) - Full equipment name
  - note (text) - Additional notes/description
  - attribute (text) - Short name/code
  - sku (text, unique) - Article number (e.g., VI_FIX_FRM)
  - quantity (integer) - Total quantity available
  - rental_price (decimal) - Rental price in dollars
  - power (text) - Power consumption (for electrical equipment)
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ## Security
  - Enable RLS on equipment_items table
  - Authenticated users can view/manage equipment
*/

-- Drop old tables if they exist
DROP TABLE IF EXISTS equipment_items CASCADE;
DROP TABLE IF EXISTS equipment_categories CASCADE;

-- Create new equipment_items table matching CSV structure
CREATE TABLE IF NOT EXISTS equipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT '',
  subtype text NOT NULL DEFAULT '',
  name text NOT NULL,
  note text DEFAULT '',
  attribute text DEFAULT '',
  sku text UNIQUE,
  quantity integer NOT NULL DEFAULT 0,
  rental_price decimal(10,2) DEFAULT 0,
  power text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_equipment_items_category ON equipment_items(category);
CREATE INDEX IF NOT EXISTS idx_equipment_items_type ON equipment_items(type);
CREATE INDEX IF NOT EXISTS idx_equipment_items_subtype ON equipment_items(subtype);
CREATE INDEX IF NOT EXISTS idx_equipment_items_sku ON equipment_items(sku);
CREATE INDEX IF NOT EXISTS idx_equipment_items_name ON equipment_items(name);

-- Enable RLS
ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;

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
