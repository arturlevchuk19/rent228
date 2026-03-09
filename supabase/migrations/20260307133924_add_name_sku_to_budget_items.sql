/*
  # Add name and sku columns to budget_items

  1. Changes
    - Add `name` text column to budget_items for storing virtual/case item names
    - Add `sku` text column to budget_items for storing virtual/case item SKUs

  2. Notes
    - These fields are used when equipment_id is null (virtual items like LED cases)
    - Default to empty string to avoid breaking existing rows
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'name'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN name text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'sku'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN sku text DEFAULT '';
  END IF;
END $$;
