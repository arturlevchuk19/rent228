BEGIN;

ALTER TABLE public.equipment_items
 ADD COLUMN units_per_package integer NOT NULL DEFAULT 1 CHECK (units_per_package > 0);

-- Rebuild the generated column from its source values.
ALTER TABLE public.equipment_items
 DROP COLUMN volume_m3,
 ADD COLUMN volume_m3 numeric GENERATED ALWAYS AS (
  round(width_cm * height_cm * length_cm / 1000000 / units_per_package, 9)
 ) STORED;

COMMENT ON COLUMN public.equipment_items.volume_m3 IS 'Volume per item in cubic meters, calculated from the packaged dimensions divided by units per package';

NOTIFY pgrst, 'reload schema';
COMMIT;
