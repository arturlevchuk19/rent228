BEGIN;
CREATE OR REPLACE FUNCTION public.employee_claim_bootstrap() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE own public.personnel; result jsonb;
BEGIN
 IF NOT public.employee_claim_active() THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
 SELECT * INTO own FROM public.personnel WHERE account_user_id=auth.uid();
 SELECT jsonb_build_object('personnel',CASE WHEN own.id IS NULL THEN NULL ELSE jsonb_build_object('id',own.id,'full_name',own.full_name,'installation_rate',own.installation_rate,'warehouse_rate',own.warehouse_rate,'warehouse_work_rate',own.warehouse_work_rate) END,
 'settings',(SELECT to_jsonb(s) FROM public.employee_claim_settings s),
 'people',CASE WHEN public.app_can_access('payments',2) THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'account_user_id',p.account_user_id,'installation_rate',p.installation_rate,'warehouse_rate',p.warehouse_rate,'warehouse_work_rate',p.warehouse_work_rate) ORDER BY p.full_name),'[]') FROM public.personnel p WHERE p.account_user_id IS NOT NULL) ELSE '[]' END,
 'events',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',coalesce(nullif(e.name,''),e.event_type),'status',e.status,'venue',v.name,'event_date',e.event_date,'event_end_date',e.event_end_date,'deadline',public.employee_claim_deadline(e.event_date,e.event_end_date)) ORDER BY e.event_date DESC),'[]') FROM public.events e LEFT JOIN public.venues v ON v.id=e.venue_id),
 'assignments', (SELECT coalesce(jsonb_agg(jsonb_build_object(
   'event_id', e.id, 'id', assignment.item->>'id',
   'event_name', coalesce(nullif(e.name,''),e.event_type), 'venue', v.name,
   'event_date', e.event_date, 'work_name', assignment.item->>'work_name',
   'hours', assignment.item->>'hours'
 ) ORDER BY e.event_date DESC, e.id, assignment.position), '[]'::jsonb)
 FROM public.events e
 LEFT JOIN public.venues v ON v.id=e.venue_id
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e.project_details->'people')='array'
   THEN e.project_details->'people' ELSE '[]'::jsonb END) WITH ORDINALITY AS assignment(item, position)
 WHERE own.id IS NOT NULL AND assignment.item->>'personnel_id'=own.id::text
   AND nullif(btrim(assignment.item->>'work_name'),'') IS NOT NULL
 ),
 'today',(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date) INTO result;
 RETURN result;
END;
$$;
COMMIT;
