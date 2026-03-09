/*
  # Add parent_budget_item_id to budget_items

  1. Changes
    - Add `parent_budget_item_id` column to `budget_items` table
    - This allows tracking LED case items that belong to a parent LED screen item
    - LED cases will reference their parent LED screen via this field

  2. Notes
    - When loading warehouse specification, items with parent_budget_item_id should not be shown as separate items
    - They should only be visible through the LedSpecificationPanel of their parent
*/

-- Add parent_budget_item_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'parent_budget_item_id'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN parent_budget_item_id uuid REFERENCES budget_items(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_budget_items_parent ON budget_items(parent_budget_item_id);
  END IF;
END $$;
