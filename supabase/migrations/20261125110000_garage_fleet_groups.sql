BEGIN;

ALTER TABLE public.garage_vehicles
  ADD COLUMN fleet_group text NOT NULL DEFAULT 'staff'
  CONSTRAINT garage_vehicles_fleet_group_check CHECK (fleet_group IN ('staff', 'freelance')),
  ADD COLUMN owner_personnel_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL;

CREATE FUNCTION public.garage_owner_directory()
RETURNS TABLE(id uuid, full_name text, employment_type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT coalesce(public.app_can_access('logistics', 2), false) THEN
    RAISE EXCEPTION 'Нет доступа к редактированию транспорта' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT p.id, p.full_name::text, p.employment_type::text
  FROM public.personnel p ORDER BY p.full_name, p.id;
END;
$$;
REVOKE ALL ON FUNCTION public.garage_owner_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garage_owner_directory() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
