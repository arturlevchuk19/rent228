/*
  # Add Category to Budget Items

  1. Changes
    - Add `category_id` column to `budget_items` table
    - Add foreign key constraint to `categories` table
    - Add `sort_order` column for custom ordering within categories
    - Create index for better query performance

  2. Notes
    - category_id is nullable to allow items without categories
    - sort_order defaults to 0
*/

-- Add category_id and sort_order columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN sort_order integer DEFAULT 0;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_budget_items_category_id ON budget_items(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_sort_order ON budget_items(sort_order);
