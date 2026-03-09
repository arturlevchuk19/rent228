/*
  # Add Sort Order Fields

  1. Changes
    - Add `sort_order` field to `categories` table for custom ordering
    - Add `sort_order` field to `budget_items` table for custom ordering within categories

  2. Notes
    - Default sort_order is 0
    - Lower numbers appear first
    - Allows manual reordering via drag-and-drop
*/

-- Add sort_order to categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE categories ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;

-- Add sort_order to budget_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_budget_items_sort_order ON budget_items(category_id, sort_order);