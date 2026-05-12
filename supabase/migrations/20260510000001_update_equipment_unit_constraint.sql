DO $$
DECLARE
    cons_name TEXT;
BEGIN
    -- Find the constraint name on equipment_items for the unit column
    SELECT conname INTO cons_name
    FROM pg_constraint
    WHERE conrelid = 'equipment_items'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%unit%';

    IF cons_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE equipment_items DROP CONSTRAINT ' || cons_name;
    END IF;
END $$;

ALTER TABLE equipment_items
ADD CONSTRAINT equipment_items_unit_check 
CHECK (unit IN ('шт.', 'м.', 'комп.', 'ед.', 'чел.', 'л.', 'услуга', 'час', 'смена'));
