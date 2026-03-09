/*
  # Add is_template flag to categories

  Changes:
  - Add `is_template` boolean column to `categories` table (default FALSE)
  - This allows distinguishing categories created from templates
    from manually created categories
  - Template categories should not appear in the "Add category" dropdown
  - Categories from templates should not be deletable from the database
*/

-- Add is_template column to categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'is_template'
  ) THEN
    ALTER TABLE categories ADD COLUMN is_template boolean DEFAULT FALSE;
  END IF;
END $$;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_categories_is_template ON categories(is_template);
