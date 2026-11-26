BEGIN;

ALTER TABLE public.equipment_items
 ADD COLUMN unpacked_width_cm numeric(12,3) CHECK (unpacked_width_cm >= 0),
 ADD COLUMN unpacked_height_cm numeric(12,3) CHECK (unpacked_height_cm >= 0),
 ADD COLUMN unpacked_length_cm numeric(12,3) CHECK (unpacked_length_cm >= 0);

COMMENT ON COLUMN public.equipment_items.width_cm IS 'Width with packaging in centimeters';
COMMENT ON COLUMN public.equipment_items.height_cm IS 'Height with packaging in centimeters';
COMMENT ON COLUMN public.equipment_items.length_cm IS 'Length with packaging in centimeters';
COMMENT ON COLUMN public.equipment_items.volume_m3 IS 'Volume with packaging in cubic meters, calculated from the packaged dimensions';

NOTIFY pgrst, 'reload schema';
COMMIT;
