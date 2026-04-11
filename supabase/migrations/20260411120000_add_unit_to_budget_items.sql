/*
  # Add unit of measurement to budget items

  1. New Column
    - `unit` (text) - единица измерения: шт., м., комп., ед., чел.
    - Default: 'шт.'

  2. Check constraint
    - Only allowed values: 'шт.', 'м.', 'комп.', 'ед.', 'чел.'
*/

-- Add unit column to budget_items table
ALTER TABLE budget_items
ADD COLUMN IF NOT EXISTS unit text DEFAULT 'шт.';

-- Update existing rows to have default unit
UPDATE budget_items SET unit = 'шт.' WHERE unit IS NULL;

-- Add check constraint for valid units
ALTER TABLE budget_items
DROP CONSTRAINT IF EXISTS budget_items_unit_check;

ALTER TABLE budget_items
ADD CONSTRAINT budget_items_unit_check
CHECK (unit IN ('шт.', 'м.', 'комп.', 'ед.', 'чел.'));
