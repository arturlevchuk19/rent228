/*
  # Fix Budget Items Nullable Fields

  1. Changes
    - Make equipment_id nullable (allow NULL when item_type is 'work')
    - Make work_item_id nullable (allow NULL when item_type is 'equipment')
    - Add constraint to ensure at least one of equipment_id or work_item_id is set
*/

-- Make equipment_id nullable
ALTER TABLE budget_items ALTER COLUMN equipment_id DROP NOT NULL;

-- Add check constraint to ensure either equipment_id or work_item_id is set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'budget_items_has_item'
  ) THEN
    ALTER TABLE budget_items ADD CONSTRAINT budget_items_has_item 
    CHECK (
      (item_type = 'equipment' AND equipment_id IS NOT NULL AND work_item_id IS NULL) OR
      (item_type = 'work' AND work_item_id IS NOT NULL AND equipment_id IS NULL)
    );
  END IF;
END $$;
