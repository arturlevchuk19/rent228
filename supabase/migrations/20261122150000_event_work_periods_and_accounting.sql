BEGIN;

CREATE FUNCTION public.event_work_assignments(p_review boolean) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.employee_claim_active() OR (p_review AND NOT public.app_can_access('payments', 1)) THEN
    RAISE EXCEPTION 'Недостаточно прав для просмотра назначенных работ' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', assignment.item->>'id', 'event_id', e.id, 'event_name', coalesce(nullif(e.name,''), e.event_type),
    'event_date', e.event_date, 'venue', v.name, 'work_name', assignment.item->>'work_name',
    'employee_name', coalesce(nullif(assignment.item->>'name',''), p.full_name),
    'hours', assignment.item->>'hours', 'starts_at', assignment.item->>'starts_at',
    'ends_at', assignment.item->>'ends_at', 'rate', assignment.item->>'rate'
  ) ORDER BY e.event_date DESC, e.id, assignment.position), '[]'::jsonb)
  INTO result
  FROM public.events e
  LEFT JOIN public.venues v ON v.id = e.venue_id
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e.project_details->'people') = 'array'
    THEN e.project_details->'people' ELSE '[]'::jsonb END) WITH ORDINALITY AS assignment(item, position)
  LEFT JOIN public.personnel p ON p.id::text = assignment.item->>'personnel_id'
  WHERE (p_review OR p.account_user_id = auth.uid())
    AND nullif(btrim(assignment.item->>'work_name'), '') IS NOT NULL;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.event_work_assignments(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_work_assignments(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.employee_claim_bootstrap() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE own public.personnel; result jsonb;
BEGIN
 IF NOT public.employee_claim_active() THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
 SELECT * INTO own FROM public.personnel WHERE account_user_id=auth.uid();
 SELECT jsonb_build_object('personnel',CASE WHEN own.id IS NULL THEN NULL ELSE jsonb_build_object('id',own.id,'full_name',own.full_name,'installation_rate',own.installation_rate,'warehouse_rate',own.warehouse_rate,'warehouse_work_rate',own.warehouse_work_rate) END,
 'settings',(SELECT to_jsonb(s) FROM public.employee_claim_settings s),
 'people',CASE WHEN public.app_can_access('payments',2) THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'account_user_id',p.account_user_id,'installation_rate',p.installation_rate,'warehouse_rate',p.warehouse_rate,'warehouse_work_rate',p.warehouse_work_rate) ORDER BY p.full_name),'[]') FROM public.personnel p WHERE p.account_user_id IS NOT NULL) ELSE '[]' END,
 'events',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',coalesce(nullif(e.name,''),e.event_type),'status',e.status,'venue',v.name,'event_date',e.event_date,'event_end_date',e.event_end_date,'deadline',public.employee_claim_deadline(e.event_date,e.event_end_date)) ORDER BY e.event_date DESC),'[]') FROM public.events e LEFT JOIN public.venues v ON v.id=e.venue_id),
 'assignments',public.event_work_assignments(false),
 'today',(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date) INTO result;
 RETURN result;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
