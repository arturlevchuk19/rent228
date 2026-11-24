ALTER TABLE public.equipment_items
  DROP CONSTRAINT equipment_items_unit_check,
  ADD CONSTRAINT equipment_items_unit_check
    CHECK (unit IN ('шт.', 'м.', 'комп.', 'ед.', 'чел.', 'л.', 'кг', 'услуга', 'час', 'смена'));
