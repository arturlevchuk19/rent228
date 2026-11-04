BEGIN;
-- Legacy imports stored object-type descriptions in the power column.
-- Preserve numeric values, including decimal commas; clear nonnumeric values only.
UPDATE public.equipment_items SET power='0'
WHERE power IS NULL OR btrim(power) !~ '^[0-9]+([.,][0-9]+)?$';
UPDATE public.equipment_items SET peak_power='0'
WHERE peak_power IS NULL OR btrim(peak_power) !~ '^[0-9]+([.,][0-9]+)?$';
ALTER TABLE public.equipment_items DROP CONSTRAINT IF EXISTS equipment_consumption_numeric;
ALTER TABLE public.equipment_items ADD CONSTRAINT equipment_consumption_numeric CHECK (
 btrim(power) ~ '^[0-9]+([.,][0-9]+)?$' AND btrim(peak_power) ~ '^[0-9]+([.,][0-9]+)?$'
);
COMMENT ON COLUMN public.equipment_items.power IS 'Номинальное потребление (кВт)';
COMMENT ON COLUMN public.equipment_items.peak_power IS 'Пиковое потребление (кВт)';
COMMIT;
