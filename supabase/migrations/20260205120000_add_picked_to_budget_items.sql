/*
  # Add picked field to budget_items

  1. Add picked boolean field to budget_items table
  2. Set default value to false for existing records
*/

ALTER TABLE budget_items
ADD COLUMN IF NOT EXISTS picked boolean DEFAULT false;

UPDATE budget_items SET picked = false WHERE picked IS NULL;
