BEGIN;

CREATE FUNCTION public.event_garage_vehicles_with_owners()
RETURNS TABLE (id uuid, name text, plate_number text, category text, employment_type text,
               driver_name text, owner_id uuid, owner_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.id, v.name, v.plate_number, v.category, v.fleet_group, v.driver_name,
         p.id, p.full_name::text
  FROM public.garage_vehicles v
  LEFT JOIN public.personnel p ON p.id = v.owner_personnel_id
  WHERE public.app_can_access('events', 2)
  ORDER BY v.name, v.id;
$$;
REVOKE ALL ON FUNCTION public.event_garage_vehicles_with_owners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_garage_vehicles_with_owners() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
