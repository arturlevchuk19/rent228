/*
  # Add is_component flag to equipment_items

  1. Changes
    - Add `is_component` boolean column to `equipment_items`
    - Default value: false

  2. Notes
    - Marks equipment as a component that can belong to a case/kit
    - Used during specification creation to suggest selecting full cases
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_items' AND column_name = 'is_component'
  ) THEN
    ALTER TABLE equipment_items ADD COLUMN is_component boolean DEFAULT false;
  END IF;
END $$;
