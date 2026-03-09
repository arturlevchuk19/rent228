/*
  # Add Equipment Items Type Fields

  1. Changes
    - Add `object_type` column to `equipment_items` table
      - Values: 'physical' or 'virtual'
      - Default: 'physical'
    - Add `rental_type` column to `equipment_items` table  
      - Values: 'rental' or 'sublease'
      - Default: 'rental'
    - Add `has_composition` column to `equipment_items` table
      - Boolean indicating if equipment can contain other items
      - Default: false

  2. Notes
    - These fields help categorize equipment for better inventory management
    - Physical equipment = actual items that may include other materials
    - Virtual equipment = combinations of separate materials
    - Rental = equipment returned to warehouse after use
    - Sublease = equipment not returned after project
    - Has composition = can contain other equipment items
*/

-- Add object_type column to equipment_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_items' AND column_name = 'object_type'
  ) THEN
    ALTER TABLE equipment_items ADD COLUMN object_type text DEFAULT 'physical' CHECK (object_type IN ('physical', 'virtual'));
  END IF;
END $$;

-- Add rental_type column to equipment_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_items' AND column_name = 'rental_type'
  ) THEN
    ALTER TABLE equipment_items ADD COLUMN rental_type text DEFAULT 'rental' CHECK (rental_type IN ('rental', 'sublease'));
  END IF;
END $$;

-- Add has_composition column to equipment_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_items' AND column_name = 'has_composition'
  ) THEN
    ALTER TABLE equipment_items ADD COLUMN has_composition boolean DEFAULT false;
  END IF;
END $$;