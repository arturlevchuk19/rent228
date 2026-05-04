/*
  # Update unit constraint to include liters (л.)

  1. Changes
    - Drop existing check constraint on `unit` column in `equipment_items` table
    - Add new check constraint including 'л.'
*/

DO $$
DECLARE
    cons_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO cons_name
    FROM pg_constraint
    WHERE conrelid = 'equipment_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%unit%'
      AND pg_get_constraintdef(oid) LIKE '%шт.%';

    IF cons_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE equipment_items DROP CONSTRAINT ' || cons_name;
    END IF;
END $$;

ALTER TABLE equipment_items
ADD CONSTRAINT equipment_items_unit_check 
CHECK (unit IN ('шт.', 'м.', 'комп.', 'ед.', 'чел.', 'л.'));
