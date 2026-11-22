BEGIN;

CREATE FUNCTION public.assigned_event_people_options(p_event uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events e JOIN public.users u ON u.id = e.site_manager_id
    WHERE e.id = p_event AND u.id = auth.uid() AND u.status = 'active'
  ) THEN RAISE EXCEPTION 'Недостаточно прав для просмотра назначений' USING ERRCODE = '42501'; END IF;

  RETURN jsonb_build_object(
    'personnel', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'full_name', p.full_name, 'employment_type', p.employment_type,
      'show_in_budgets', p.show_in_budgets
    ) ORDER BY p.full_name), '[]'::jsonb) FROM public.personnel p WHERE p.show_in_budgets),
    'catalog', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name)
      ORDER BY w.name), '[]'::jsonb) FROM public.work_items w),
    'works', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', 'work:' || w.name, 'name', w.name, 'budgetAmount', 0
    ) ORDER BY w.name), '[]'::jsonb) FROM public.employee_claim_works(p_event) w)
  );
END;
$$;

CREATE FUNCTION public.save_assigned_event_people(p_event uuid, p_previous jsonb, p_people jsonb, p_works jsonb) RETURNS jsonb
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

  SELECT coalesce(jsonb_agg((entry.row - 'rate') || jsonb_build_object('rate',
    coalesce(old.row->>'rate', CASE
      WHEN p.id IS NULL THEN ''
      WHEN entry.row->>'work_name' ~* 'загрузка|разгрузка' THEN coalesce(p.warehouse_rate, 0)::text
      WHEN entry.row->>'work_name' ~* 'склад' THEN coalesce(p.warehouse_work_rate, 10)::text
      ELSE coalesce(p.installation_rate, 0)::text
    END)) ORDER BY entry.position), '[]'::jsonb) INTO people
  FROM jsonb_array_elements(p_people) WITH ORDINALITY AS entry(row, position)
  LEFT JOIN LATERAL (
    SELECT row FROM jsonb_array_elements(coalesce(details->'people', '[]'::jsonb)) row
    WHERE row->>'id' = entry.row->>'id'
      AND row->>'personnel_id' IS NOT DISTINCT FROM entry.row->>'personnel_id'
    LIMIT 1
  ) old ON true
  LEFT JOIN public.personnel p ON p.id::text = entry.row->>'personnel_id';

  details := details || jsonb_build_object('people', people, 'people_works', p_works);
  UPDATE public.events SET project_details = details WHERE id = p_event;
  RETURN details;
END;
$$;

REVOKE ALL ON FUNCTION public.assigned_event_people_options(uuid), public.save_assigned_event_people(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assigned_event_people_options(uuid), public.save_assigned_event_people(uuid, jsonb, jsonb, jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.account_guard_event_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE permitted text[] := ARRAY['updated_at']; changed text[];
BEGIN
  IF (auth.uid() IS NULL AND auth.role() IS NULL) OR auth.role() = 'service_role' OR public.app_can_access('events',2) THEN RETURN NEW; END IF;
  IF public.app_can_access('budgets',2) THEN
    permitted := permitted || ARRAY['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes','progress_budget_done','progress_equipment_reserved','budget','specification'];
  END IF;
  IF public.app_can_access('specifications',2) AND public.app_can_work_specification(OLD.id) THEN
    permitted := permitted || ARRAY['equipment_shipped','equipment_shipped_at','equipment_returned','equipment_returned_at','specification_confirmed','specification_confirmed_at','specification_confirmed_by'];
  END IF;
  SELECT array_agg(n.key) INTO changed FROM jsonb_each(to_jsonb(NEW)) n WHERE n.value IS DISTINCT FROM to_jsonb(OLD) -> n.key;
  IF OLD.site_manager_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'active')
    AND changed <@ ARRAY['updated_at','project_details']
    AND (NEW.project_details - 'people' - 'people_works') = (OLD.project_details - 'people' - 'people_works')
  THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM unnest(changed) key WHERE NOT (key = ANY(permitted))) THEN
    RAISE EXCEPTION 'Нет прав для изменения этих данных мероприятия' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
