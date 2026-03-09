/*
  # Allow Virtual Budget Items
  1. Changes
    - Modify budget_items_has_item constraint to allow virtual items
    - Virtual items have item_type = 'equipment' but equipment_id IS NULL
    - This enables storing computed/synthetic items like LED cases and modification components
    - Add name and sku columns to budget_items for virtual items
*/

-- Add name column for virtual items
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'name'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN name text DEFAULT '';
  END IF;
END $;

-- Add sku column for virtual items
DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'sku'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN sku text DEFAULT '';
  END IF;
END $;

-- Drop the existing constraint
ALTER TABLE budget_items DROP CONSTRAINT IF EXISTS budget_items_has_item;

-- Add new constraint that allows virtual items (both IDs can be NULL for equipment type)
ALTER TABLE budget_items ADD CONSTRAINT budget_items_has_item
CHECK (
  (item_type = 'equipment' AND work_item_id IS NULL) OR
  (item_type = 'work' AND work_item_id IS NOT NULL AND equipment_id IS NULL)
);
