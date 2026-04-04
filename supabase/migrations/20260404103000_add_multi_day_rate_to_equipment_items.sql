/*
  # Add multi-day rental coefficient for equipment items

  1. Schema
    - Add `multi_day_rate` column to `equipment_items`

  2. Data migration
    - Set coefficient to 0.5 for all items with rental_price > 0
    - Set coefficient to 0.2 for category "Сцена" items with rental_price > 0
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equipment_items' AND column_name = 'multi_day_rate'
  ) THEN
    ALTER TABLE equipment_items
      ADD COLUMN multi_day_rate decimal(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

UPDATE equipment_items
SET multi_day_rate = 0.5
WHERE rental_price > 0
  AND lower(trim(category)) <> 'сцена';

UPDATE equipment_items
SET multi_day_rate = 0.2
WHERE rental_price > 0
  AND lower(trim(category)) = 'сцена';
