BEGIN;

CREATE FUNCTION public.event_garage_vehicles()
RETURNS TABLE (id uuid, name text, plate_number text, category text, employment_type text, driver_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.id, v.name, v.plate_number, v.category, v.fleet_group, v.driver_name
  FROM public.garage_vehicles v
  WHERE public.app_can_access('events', 2)
  ORDER BY v.name, v.id;
$$;
REVOKE ALL ON FUNCTION public.event_garage_vehicles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_garage_vehicles() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_assigned_event_people(p_event uuid, p_previous jsonb, p_people jsonb, p_works jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE details jsonb; people jsonb;
BEGIN
  SELECT e.project_details INTO details
  FROM public.events e JOIN public.users u ON u.id = e.site_manager_id
  WHERE e.id = p_event AND u.id = auth.uid() AND u.status = 'active'
  FOR UPDATE OF e;
  IF NOT FOUND THEN RAISE EXCEPTION 'Недостаточно прав для изменения назначений' USING ERRCODE = '42501'; END IF;
  IF (details->'people') IS DISTINCT FROM (p_previous->'people') OR
     (details->'people_works') IS DISTINCT FROM (p_previous->'people_works') THEN
    RAISE EXCEPTION 'Назначения уже изменились. Откройте мероприятие заново.';
  END IF;
  IF jsonb_typeof(p_people) IS DISTINCT FROM 'array' OR jsonb_typeof(p_works) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Некорректный список назначений';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_people) entry(row)
    WHERE entry.row ? 'trip' AND (
      jsonb_typeof(entry.row->'trip') IS DISTINCT FROM 'object'
      OR CASE WHEN (entry.row->'trip'->>'kilometers') ~ '^[0-9]+([.][0-9]+)?([eE][+-]?[0-9]{1,3})?$'
        AND length(entry.row->'trip'->>'kilometers') <= 40
        THEN (entry.row->'trip'->>'kilometers')::numeric <= 0
        ELSE true END
      OR jsonb_typeof(entry.row->'trip'->'own_car') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(entry.row->'trip'->'own_fuel') IS DISTINCT FROM 'boolean'
    )
  ) THEN RAISE EXCEPTION 'Некорректные данные поездки'; END IF;

  SELECT coalesce(jsonb_agg((entry.row - 'rate') || jsonb_build_object('rate',
    CASE WHEN entry.row ? 'trip' THEN
      CASE WHEN ((old.row->'trip') - 'kilometers') = ((entry.row->'trip') - 'kilometers') THEN old.row->>'rate'
      ELSE (SELECT (s.driver_rate
        + CASE WHEN entry.row->'trip'->'own_car' = 'true'::jsonb THEN s.car_rate ELSE 0 END
        + CASE WHEN entry.row->'trip'->'own_fuel' = 'true'::jsonb THEN s.fuel_rate ELSE 0 END)::text
        FROM public.employee_claim_settings s WHERE s.id)
      END
    ELSE coalesce(old.row->>'rate', CASE
      WHEN p.id IS NULL THEN ''
      WHEN entry.row->>'work_name' ~* 'загрузка|разгрузка' THEN coalesce(p.warehouse_rate, 0)::text
      WHEN entry.row->>'work_name' ~* 'склад' THEN coalesce(p.warehouse_work_rate, 10)::text
      ELSE coalesce(p.installation_rate, 0)::text
    END) END) ORDER BY entry.position), '[]'::jsonb) INTO people
  FROM jsonb_array_elements(p_people) WITH ORDINALITY AS entry(row, position)
  LEFT JOIN LATERAL (
    SELECT prior.item AS row
    FROM jsonb_array_elements(coalesce(details->'people', '[]'::jsonb)) AS prior(item)
    WHERE prior.item->>'id' = entry.row->>'id'
      AND prior.item->>'personnel_id' IS NOT DISTINCT FROM entry.row->>'personnel_id'
    LIMIT 1
  ) old ON true
  LEFT JOIN public.personnel p ON p.id::text = entry.row->>'personnel_id';

  details := details || jsonb_build_object('people', people, 'people_works', p_works);
  UPDATE public.events SET project_details = details WHERE id = p_event;
  RETURN details;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
