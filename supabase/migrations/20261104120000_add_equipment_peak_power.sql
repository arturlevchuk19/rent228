BEGIN;

-- Keep the existing text field and values: historical entries may contain units.
ALTER TABLE public.equipment_items ADD COLUMN IF NOT EXISTS peak_power text;

UPDATE public.equipment_items
SET power = '0'
WHERE power IS NULL OR btrim(power) = '';

-- Only initialize missing peak values; re-running must preserve edited values.
UPDATE public.equipment_items
SET peak_power = power
WHERE peak_power IS NULL OR btrim(peak_power) = '';

ALTER TABLE public.equipment_items
  ALTER COLUMN power SET DEFAULT '0',
  ALTER COLUMN power SET NOT NULL,
  ALTER COLUMN peak_power SET DEFAULT '0',
  ALTER COLUMN peak_power SET NOT NULL;

COMMENT ON COLUMN public.equipment_items.power IS 'Номинальное потребление (В)';
COMMENT ON COLUMN public.equipment_items.peak_power IS 'Пиковое потребление (В)';
NOTIFY pgrst, 'reload schema';
COMMIT;
