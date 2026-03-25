/*
  # Add is_template column to categories table

  ## Summary
  Adds the missing `is_template` boolean column to the `categories` table.
  This column is used to distinguish between regular event categories and
  categories that were automatically created when applying a template to an event.

  ## Changes
  - `categories` table: add `is_template` column (boolean, default false)

  ## Notes
  - Existing categories will get `is_template = false` by default
  - Categories created by applying templates will have `is_template = true`
  - The BudgetEditor filters out template categories from the category selector
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'is_template'
  ) THEN
    ALTER TABLE categories ADD COLUMN is_template boolean NOT NULL DEFAULT false;
  END IF;
END $$;
