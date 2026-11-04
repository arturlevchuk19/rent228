BEGIN;
CREATE TABLE IF NOT EXISTS public.garage_vehicles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 category text NOT NULL DEFAULT 'cargo' CHECK (category IN ('cargo','passenger')),
 status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','in_use','repair','inactive')),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
 plate_country text NOT NULL DEFAULT 'BY' CHECK (length(plate_country) BETWEEN 2 AND 5),
 plate_number text NOT NULL DEFAULT '' CHECK (length(plate_number)<=32),
 brand_model text NOT NULL DEFAULT '' CHECK (length(brand_model)<=200),
 body_type text NOT NULL DEFAULT '' CHECK (length(body_type)<=200),
 payload text NOT NULL DEFAULT '' CHECK (length(payload)<=100),
 dimensions text NOT NULL DEFAULT '' CHECK (length(dimensions)<=100),
 fuel text NOT NULL DEFAULT '' CHECK (fuel IN ('','petrol','diesel','gas','hybrid','electric')),
 fuel_consumption numeric(10,2) CHECK (fuel_consumption>=0 AND fuel_consumption<10000),
 driver_name text NOT NULL DEFAULT '' CHECK (length(driver_name)<=200),
 phone_country text NOT NULL DEFAULT 'BY' CHECK (length(phone_country) BETWEEN 2 AND 5),
 driver_phone text NOT NULL DEFAULT '' CHECK (length(driver_phone)<=50),
 photo_path text,
 created_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
 updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.garage_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS garage_read ON public.garage_vehicles;
CREATE POLICY garage_read ON public.garage_vehicles FOR SELECT TO authenticated USING(public.app_can_access('logistics',1));
DROP POLICY IF EXISTS garage_insert ON public.garage_vehicles;
CREATE POLICY garage_insert ON public.garage_vehicles FOR INSERT TO authenticated WITH CHECK(public.app_can_access('logistics',2));
DROP POLICY IF EXISTS garage_update ON public.garage_vehicles;
CREATE POLICY garage_update ON public.garage_vehicles FOR UPDATE TO authenticated USING(public.app_can_access('logistics',2)) WITH CHECK(public.app_can_access('logistics',2));
DROP POLICY IF EXISTS garage_delete ON public.garage_vehicles;
CREATE POLICY garage_delete ON public.garage_vehicles FOR DELETE TO authenticated USING(public.app_can_access('logistics',3));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.garage_vehicles TO authenticated;
CREATE OR REPLACE FUNCTION public.garage_stamp_vehicle() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.created_by=auth.uid(); NEW.created_at=now();
 ELSE
  -- Preserve the creator, while allowing the FK to clear a deleted account.
  IF OLD.created_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.users WHERE id=OLD.created_by) THEN NEW.created_by=NULL; ELSE NEW.created_by=OLD.created_by; END IF;
  NEW.created_at=OLD.created_at;
 END IF;
 NEW.updated_by=auth.uid(); NEW.updated_at=clock_timestamp(); RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS garage_stamp_vehicle ON public.garage_vehicles;
CREATE TRIGGER garage_stamp_vehicle BEFORE INSERT OR UPDATE ON public.garage_vehicles FOR EACH ROW EXECUTE FUNCTION public.garage_stamp_vehicle();
CREATE INDEX IF NOT EXISTS garage_vehicles_category_idx ON public.garage_vehicles(category,name);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('garage-photos','garage-photos',false,8388608,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS garage_photo_read ON storage.objects;
CREATE POLICY garage_photo_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='garage-photos' AND public.app_can_access('logistics',1));
DROP POLICY IF EXISTS garage_photo_insert ON storage.objects;
CREATE POLICY garage_photo_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='garage-photos' AND public.app_can_access('logistics',2));
DROP POLICY IF EXISTS garage_photo_update ON storage.objects;
CREATE POLICY garage_photo_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='garage-photos' AND public.app_can_access('logistics',2)) WITH CHECK(bucket_id='garage-photos' AND public.app_can_access('logistics',2));
DROP POLICY IF EXISTS garage_photo_delete ON storage.objects;
CREATE POLICY garage_photo_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='garage-photos' AND public.app_can_access('logistics',2));
NOTIFY pgrst,'reload schema';
COMMIT;
