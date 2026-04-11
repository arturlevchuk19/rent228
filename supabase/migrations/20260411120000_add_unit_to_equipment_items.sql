/*
  # Add unit field to equipment_items

  ## Summary
  - Add `unit` column to `equipment_items`
  - Restrict values to: шт., м., комп., ед., чел.
  - Default value is `шт.`
*/

ALTER TABLE equipment_items
ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'шт.'
CHECK (unit IN ('шт.', 'м.', 'комп.', 'ед.', 'чел.'));
