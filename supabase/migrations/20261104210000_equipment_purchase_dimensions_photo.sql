BEGIN;
ALTER TABLE public.equipment_items
 ADD COLUMN IF NOT EXISTS purchase_price numeric(14,2) CHECK(purchase_price>=0),
 ADD COLUMN IF NOT EXISTS weight_kg numeric(12,3) CHECK(weight_kg>=0),
 ADD COLUMN IF NOT EXISTS width_cm numeric(12,3) CHECK(width_cm>=0),
 ADD COLUMN IF NOT EXISTS height_cm numeric(12,3) CHECK(height_cm>=0),
 ADD COLUMN IF NOT EXISTS length_cm numeric(12,3) CHECK(length_cm>=0),
 ADD COLUMN IF NOT EXISTS volume_m3 numeric GENERATED ALWAYS AS (round(width_cm*height_cm*length_cm/1000000,9)) STORED,
 ADD COLUMN IF NOT EXISTS photo_path text;
COMMENT ON COLUMN public.equipment_items.volume_m3 IS 'Width × height × length in cm divided by 1000000; computed, not editable';
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('equipment-photos','equipment-photos',false,8388608,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS equipment_photo_read ON storage.objects;
CREATE POLICY equipment_photo_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='equipment-photos' AND public.app_can_access('equipment',1));
DROP POLICY IF EXISTS equipment_photo_insert ON storage.objects;
CREATE POLICY equipment_photo_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='equipment-photos' AND public.app_can_access('equipment',2));
DROP POLICY IF EXISTS equipment_photo_update ON storage.objects;
CREATE POLICY equipment_photo_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='equipment-photos' AND public.app_can_access('equipment',2)) WITH CHECK(bucket_id='equipment-photos' AND public.app_can_access('equipment',2));
DROP POLICY IF EXISTS equipment_photo_delete ON storage.objects;
CREATE POLICY equipment_photo_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='equipment-photos' AND public.app_can_access('equipment',2));
NOTIFY pgrst,'reload schema';
COMMIT;
