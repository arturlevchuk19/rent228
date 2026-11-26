BEGIN;

-- Operational event edits preserve staffing and journeys managed by accounting.
CREATE FUNCTION public.accounting_event_fields(p_details jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  FROM jsonb_each(coalesce(p_details, '{}'::jsonb))
  WHERE key IN ('people','transport','people_works','people_budget_id')
$$;

CREATE OR REPLACE FUNCTION public.account_guard_event_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE permitted text[] := ARRAY['updated_at']; changed text[];
  fields text[] := ARRAY['people','transport','people_works','people_budget_id'];
BEGIN
  IF current_setting('app.accounting_event_write', true) = OLD.id::text
     AND (to_jsonb(NEW) - 'project_details' - 'updated_at') = (to_jsonb(OLD) - 'project_details' - 'updated_at')
     AND (NEW.project_details - fields) = (OLD.project_details - fields) THEN
    RETURN NEW;
  END IF;
  IF NEW.project_details IS DISTINCT FROM OLD.project_details THEN
    NEW.project_details := (coalesce(NEW.project_details, '{}'::jsonb) - fields)
      || public.accounting_event_fields(OLD.project_details);
  END IF;
  IF (auth.uid() IS NULL AND auth.role() IS NULL) OR auth.role() = 'service_role' OR public.app_can_access('events',2) THEN RETURN NEW; END IF;
  IF public.app_can_access('budgets',2) THEN
    permitted := permitted || ARRAY['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes','progress_budget_done','progress_equipment_reserved','budget','specification'];
  END IF;
  IF public.app_can_access('specifications',2) AND public.app_can_work_specification(OLD.id) THEN
    permitted := permitted || ARRAY['equipment_shipped','equipment_shipped_at','equipment_returned','equipment_returned_at','specification_confirmed','specification_confirmed_at','specification_confirmed_by'];
  END IF;
  SELECT array_agg(n.key) INTO changed FROM jsonb_each(to_jsonb(NEW)) n WHERE n.value IS DISTINCT FROM to_jsonb(OLD) -> n.key;
  IF EXISTS(SELECT 1 FROM unnest(changed) key WHERE NOT (key = ANY(permitted))) THEN
    RAISE EXCEPTION 'Нет прав для изменения этих данных мероприятия' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE public.accounting_staff_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  personnel_ids uuid[] NOT NULL CHECK (cardinality(personnel_ids) BETWEEN 1 AND 200)
);
ALTER TABLE public.accounting_staff_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounting_staff_templates_read ON public.accounting_staff_templates FOR SELECT TO authenticated
  USING (public.app_can_access('payments',1));
CREATE POLICY accounting_staff_templates_write ON public.accounting_staff_templates FOR INSERT TO authenticated
  WITH CHECK (public.app_can_access('payments',2));
GRANT SELECT,INSERT ON public.accounting_staff_templates TO authenticated;

CREATE FUNCTION public.accounting_event_budget(p_event uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT coalesce(public.app_can_access('payments', 1), false) THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'budgets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'event_id',b.event_id,'name',b.name,
      'is_primary',b.is_primary,'settings',b.settings - ARRAY['budget_note','sticky_notes'],'created_at',b.created_at)
      ORDER BY b.is_primary DESC,b.sort_order,b.created_at,b.id), '[]') FROM public.event_budgets b WHERE b.event_id = p_event),
    'items', (SELECT coalesce(jsonb_agg(to_jsonb(i) || jsonb_build_object('work_item', jsonb_build_object('name',w.name))
      ORDER BY i.sort_order,i.created_at), '[]') FROM public.budget_items i LEFT JOIN public.work_items w ON w.id=i.work_item_id
      WHERE i.event_id = p_event AND i.item_type = 'work'),
    'assigned', (SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]') FROM (
      SELECT DISTINCT person.id,person.full_name,person.employment_type
      FROM public.budget_item_personnel a JOIN public.budget_items i ON i.id = a.budget_item_id
      JOIN public.personnel person ON person.id = a.personnel_id WHERE i.event_id = p_event
    ) p)
  );
END;
$$;

CREATE FUNCTION public.accounting_event_open(p_event uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT coalesce(public.app_can_access('payments', 1), false) THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'details', public.accounting_event_fields(e.project_details),
    'personnel', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'employment_type', p.employment_type, 'show_in_budgets', p.show_in_budgets,
      'warehouse_rate', p.warehouse_rate, 'warehouse_work_rate', p.warehouse_work_rate, 'installation_rate', p.installation_rate
    ) ORDER BY p.full_name), '[]') FROM public.personnel p),
    'catalog', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name) ORDER BY w.name), '[]') FROM public.work_items w)
  ) INTO result FROM public.events e WHERE e.id = p_event;
  IF NOT FOUND THEN RAISE EXCEPTION 'Мероприятие не найдено'; END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION public.accounting_event_save(p_event uuid, p_previous jsonb, p_details jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE original jsonb; details jsonb;
BEGIN
  IF NOT coalesce(public.app_can_access('payments', 2), false) THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(e.project_details, '{}'::jsonb) INTO original FROM public.events e WHERE e.id = p_event FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Мероприятие не найдено'; END IF;
  IF public.accounting_event_fields(original) IS DISTINCT FROM p_previous THEN
    RAISE EXCEPTION 'Расчёт уже изменился. Откройте мероприятие заново.';
  END IF;
  details := public.accounting_event_fields(p_details);
  IF jsonb_typeof(details->'people') IS DISTINCT FROM 'array' OR jsonb_typeof(details->'transport') IS DISTINCT FROM 'array'
     OR jsonb_typeof(details->'people_works') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Некорректные данные расчёта'; END IF;
  PERFORM set_config('app.accounting_event_write', p_event::text, true);
  UPDATE public.events SET project_details = (original - ARRAY['people','transport','people_works','people_budget_id']) || details WHERE id = p_event;
  PERFORM set_config('app.accounting_event_write', '', true);
  RETURN details;
END;
$$;

CREATE OR REPLACE FUNCTION public.event_garage_vehicles_with_owners()
RETURNS TABLE (id uuid, name text, plate_number text, category text, employment_type text, driver_name text, owner_id uuid, owner_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.id, v.name, v.plate_number, v.category, v.fleet_group, v.driver_name, p.id, p.full_name::text
  FROM public.garage_vehicles v LEFT JOIN public.personnel p ON p.id = v.owner_personnel_id
  WHERE public.app_can_access('payments', 2) OR public.app_can_access('events', 2)
  ORDER BY v.name, v.id
$$;

REVOKE ALL ON FUNCTION public.accounting_event_fields(jsonb), public.accounting_event_budget(uuid), public.accounting_event_open(uuid), public.accounting_event_save(uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_event_budget(uuid), public.accounting_event_open(uuid), public.accounting_event_save(uuid,jsonb,jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
