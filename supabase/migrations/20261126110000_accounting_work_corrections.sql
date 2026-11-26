BEGIN;

CREATE TABLE public.accounting_work_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  target_id text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('person','driver','owner','claim')),
  employee_name text NOT NULL,
  event_name text NOT NULL,
  work_name text NOT NULL,
  original jsonb NOT NULL,
  proposal jsonb NOT NULL,
  state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','approved','rejected')),
  review_note text NOT NULL DEFAULT '',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX accounting_work_corrections_pending
  ON public.accounting_work_corrections (event_id,user_id,target_kind,target_id) WHERE state = 'submitted';
CREATE UNIQUE INDEX accounting_claim_corrections_pending ON public.accounting_work_corrections (target_id,user_id)
  WHERE state = 'submitted' AND target_kind = 'claim';
ALTER TABLE public.accounting_work_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounting_work_corrections_read ON public.accounting_work_corrections FOR SELECT TO authenticated
  USING (public.employee_claim_active() AND (user_id = auth.uid() OR public.app_can_access('payments',1)));
GRANT SELECT ON public.accounting_work_corrections TO authenticated;

-- Only this function enumerates source rows and their ownership. Callers use its stable row IDs.
CREATE FUNCTION public.accounting_work_sources(p_event uuid DEFAULT NULL)
RETURNS TABLE (event_id uuid,event_name text,event_date text,kind text,target_id text,personnel_id text,work_name text,item jsonb,part jsonb)
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT e.id, coalesce(nullif(e.name,''),e.event_type), e.event_date::text,
    'person', p.item->>'id', p.item->>'personnel_id', p.item->>'work_name', p.item, p.item
  FROM public.events e CROSS JOIN LATERAL jsonb_array_elements(coalesce(e.project_details->'people', '[]')) p(item)
  WHERE p_event IS NULL OR e.id = p_event
  UNION ALL
  SELECT e.id, coalesce(nullif(e.name,''),e.event_type), e.event_date::text,
    'driver', t.item->>'id', d.item->>'id', t.item->'journey'->>'work_name', t.item, d.item
  FROM public.events e CROSS JOIN LATERAL jsonb_array_elements(coalesce(e.project_details->'transport', '[]')) t(item)
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.item->'journey'->'drivers') = 'array'
    THEN t.item->'journey'->'drivers' WHEN jsonb_typeof(t.item->'journey'->'driver') = 'object'
    THEN jsonb_build_array(t.item->'journey'->'driver') ELSE '[]'::jsonb END) d(item)
  WHERE p_event IS NULL OR e.id = p_event
  UNION ALL
  SELECT e.id, coalesce(nullif(e.name,''),e.event_type), e.event_date::text,
    'owner', t.item->>'id', t.item->'journey'->'owner'->>'id', t.item->'journey'->>'work_name',
    t.item, t.item->'journey'->'owner'
  FROM public.events e CROSS JOIN LATERAL jsonb_array_elements(coalesce(e.project_details->'transport', '[]')) t(item)
  WHERE (p_event IS NULL OR e.id = p_event) AND t.item->'journey' ? 'owner'
$$;

CREATE FUNCTION public.accounting_my_work() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(s) - 'personnel_id' - 'item' || jsonb_build_object('item',
    CASE WHEN s.kind = 'person' THEN s.part
      WHEN s.kind = 'owner' THEN (s.item - 'journey' - 'driver') || jsonb_build_object('journey',
        (s.item->'journey') - 'drivers' - 'driver')
      ELSE jsonb_build_object('vehicle', s.item->'vehicle') END)
    ORDER BY s.event_date DESC,s.event_id,s.work_name), '[]')
  FROM public.accounting_work_sources() s JOIN public.personnel p ON p.id::text = s.personnel_id
  WHERE p.account_user_id = auth.uid() AND public.employee_claim_active()
$$;

CREATE FUNCTION public.accounting_submit_work_correction(p_event uuid, p_kind text, p_target text, p_original jsonb, p_proposal jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE source record; km numeric; amount numeric; start_at timestamp; end_at timestamp; units numeric;
  snapshot jsonb; changes jsonb; input_rate numeric; work_hours numeric;
BEGIN
  IF NOT public.employee_claim_active() THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.events WHERE id = p_event FOR UPDATE;
  SELECT s.*, p.full_name INTO source FROM public.accounting_work_sources(p_event) s
    JOIN public.personnel p ON p.id::text = s.personnel_id
    WHERE p.account_user_id = auth.uid() AND s.kind = p_kind AND s.target_id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'Назначение не найдено'; END IF;
  snapshot := CASE WHEN p_kind = 'driver' THEN source.part WHEN p_kind = 'owner'
    THEN (source.item - 'journey' - 'driver') || jsonb_build_object('journey', (source.item->'journey') - 'drivers' - 'driver')
    ELSE source.item END;
  IF snapshot IS DISTINCT FROM p_original THEN RAISE EXCEPTION 'Расчёт уже изменился. Обновите список.'; END IF;
  IF p_kind = 'driver' OR (p_kind = 'owner' AND source.item->>'category' = 'passenger')
     OR (p_kind = 'person' AND source.item ? 'trip') THEN
    km := (p_proposal->>'kilometers')::numeric;
    IF km IS NULL OR km <= 0 OR km > 1000000 THEN RAISE EXCEPTION 'Укажите положительный километраж'; END IF;
    changes := jsonb_build_object('kilometers', km);
    IF p_kind = 'person' THEN
      amount := (p_proposal->>'amount')::numeric;
      IF amount IS NOT NULL AND (amount < 0 OR amount > 1000000000) THEN RAISE EXCEPTION 'Проверьте сумму'; END IF;
      IF amount IS NOT NULL THEN
        input_rate := round(amount / km, 2);
        IF round(km * input_rate, 2) <> amount THEN RAISE EXCEPTION 'Эту сумму нельзя получить со ставкой, округлённой до копеек. Уточните километраж или сумму.'; END IF;
        changes := changes || jsonb_build_object('rate', input_rate::text);
      END IF;
    END IF;
  ELSIF p_kind = 'owner' THEN
    amount := (p_proposal->>'amount')::numeric;
    IF amount IS NULL OR amount < 0 OR amount > 1000000000 THEN RAISE EXCEPTION 'Проверьте стоимость поездки'; END IF;
    changes := jsonb_build_object('trip_price', round(amount, 2));
  ELSE
    start_at := nullif(p_proposal->>'starts_at','')::timestamp;
    end_at := nullif(p_proposal->>'ends_at','')::timestamp;
    amount := nullif(p_proposal->>'amount','')::numeric;
    work_hours := nullif(p_proposal->>'hours','')::numeric;
    IF start_at IS NOT NULL OR end_at IS NOT NULL THEN
      IF start_at IS NULL OR end_at IS NULL OR end_at <= start_at THEN RAISE EXCEPTION 'Проверьте начало и окончание работы'; END IF;
      units := extract(epoch FROM end_at - start_at) / 3600;
      changes := jsonb_build_object('starts_at', to_char(start_at,'YYYY-MM-DD"T"HH24:MI'), 'ends_at', to_char(end_at,'YYYY-MM-DD"T"HH24:MI'));
    ELSE
      IF work_hours IS NULL OR work_hours <= 0 OR work_hours > 1000000 THEN RAISE EXCEPTION 'Укажите продолжительность работы'; END IF;
      units := work_hours;
      changes := jsonb_build_object('hours', work_hours::text);
    END IF;
    IF amount IS NOT NULL THEN
      IF amount < 0 OR amount > 1000000000 THEN RAISE EXCEPTION 'Проверьте сумму'; END IF;
      changes := changes || jsonb_build_object('rate', (amount / units)::text);
    END IF;
  END IF;
  INSERT INTO public.accounting_work_corrections(event_id,target_id,target_kind,employee_name,event_name,work_name,original,proposal)
    VALUES(p_event,p_target,p_kind,source.full_name,source.event_name,coalesce(source.work_name,'Работа'),snapshot,changes);

END;
$$;

CREATE FUNCTION public.accounting_submit_claim_correction(p_claim uuid, p_revision integer, p_lines jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE claim public.employee_claims; proposed jsonb;
BEGIN
  IF NOT public.employee_claim_active() THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE = '42501'; END IF;
  SELECT * INTO claim FROM public.employee_claims WHERE id = p_claim FOR UPDATE;
  IF NOT FOUND OR claim.user_id IS DISTINCT FROM auth.uid() OR claim.state <> 'approved' THEN
    RAISE EXCEPTION 'Заявка недоступна для исправления' USING ERRCODE = '42501';
  END IF;
  IF claim.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Заявка уже изменилась'; END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) <> jsonb_array_length(claim.lines) THEN
    RAISE EXCEPTION 'Исправьте существующие позиции заявки';
  END IF;
  SELECT jsonb_agg(original.item || jsonb_strip_nulls(jsonb_build_object(
    'starts_at', draft.item->'starts_at', 'ends_at', draft.item->'ends_at', 'kilometers', draft.item->'kilometers',
    'amount', draft.item->'amount', 'rate', draft.item->'rate', 'description', draft.item->'description'
  )) ORDER BY original.pos) INTO proposed
  FROM jsonb_array_elements(claim.lines) WITH ORDINALITY original(item,pos)
  JOIN jsonb_array_elements(p_lines) WITH ORDINALITY draft(item,pos) USING(pos);
  IF proposed IS NOT DISTINCT FROM claim.lines THEN RAISE EXCEPTION 'Внесите изменения в заявку'; END IF;
  INSERT INTO public.accounting_work_corrections(event_id,target_id,target_kind,employee_name,event_name,work_name,original,proposal)
    VALUES(claim.event_id,claim.id::text,'claim',claim.employee_name,claim.event_name,'Заявка сотрудника',
      jsonb_build_object('revision',claim.revision,'lines',claim.lines),jsonb_build_object('lines',proposed));
END;
$$;

CREATE FUNCTION public.accounting_review_work_correction(p_id uuid, p_action text, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request public.accounting_work_corrections; details jsonb; source record; snapshot jsonb;
  changed jsonb; rows jsonb; field text; person_id text;
  claim public.employee_claims;
BEGIN
  IF NOT public.employee_claim_active() THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE = '42501'; END IF;
  SELECT * INTO request FROM public.accounting_work_corrections WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Заявка не найдена'; END IF;
  IF p_action = 'approve' AND coalesce(public.app_can_access('payments',2),false) THEN
    IF request.target_kind = 'claim' THEN
      PERFORM 1 FROM public.employee_claims WHERE id = request.target_id::uuid FOR UPDATE;
    ELSE
      PERFORM 1 FROM public.events WHERE id = request.event_id FOR UPDATE;
    END IF;
  END IF;
  SELECT * INTO request FROM public.accounting_work_corrections WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Заявка не найдена'; END IF;
  IF p_action = 'archive' AND request.user_id = auth.uid() AND request.state <> 'submitted' THEN
    UPDATE public.accounting_work_corrections SET archived_at = now() WHERE id = p_id;
    RETURN;
  END IF;
  IF NOT coalesce(public.app_can_access('payments',2),false) THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE = '42501'; END IF;
  IF request.state <> 'submitted' OR p_action IS NULL OR p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Заявка уже рассмотрена'; END IF;
  IF p_action = 'reject' THEN
    IF nullif(btrim(p_note),'') IS NULL THEN RAISE EXCEPTION 'Укажите причину отклонения'; END IF;
  ELSIF request.target_kind = 'claim' THEN
    SELECT * INTO claim FROM public.employee_claims WHERE id = request.target_id::uuid FOR UPDATE;
    IF NOT FOUND OR claim.state <> 'approved' OR claim.revision IS DISTINCT FROM (request.original->>'revision')::integer THEN
      RAISE EXCEPTION 'Исходная заявка уже изменилась. Отклоните правку и укажите причину.';
    END IF;
    claim := public.employee_claim_save(claim.id,claim.event_id,request.proposal->'lines',true,claim.revision,
      claim.personnel_id,coalesce(nullif(btrim(p_note),''),'Подтверждена правка сотрудника'));
    PERFORM public.employee_claim_review(claim.id,'approve',claim.revision,coalesce(nullif(btrim(p_note),''),'Подтверждена правка сотрудника'));
  ELSE
    SELECT project_details INTO details FROM public.events WHERE id = request.event_id FOR UPDATE;
    SELECT s.* INTO source FROM public.accounting_work_sources(request.event_id) s
      JOIN public.personnel p ON p.id::text = s.personnel_id
      WHERE p.account_user_id = request.user_id AND s.kind = request.target_kind AND s.target_id = request.target_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Назначение удалено'; END IF;
    snapshot := CASE WHEN source.kind = 'driver' THEN source.part WHEN source.kind = 'owner'
      THEN (source.item - 'journey' - 'driver') || jsonb_build_object('journey', (source.item->'journey') - 'drivers' - 'driver')
      ELSE source.item END;
    IF snapshot IS DISTINCT FROM request.original THEN RAISE EXCEPTION 'Назначение уже изменилось. Отклоните заявку и укажите причину.'; END IF;
    changed := source.item;
    field := CASE WHEN source.kind = 'person' THEN 'people' ELSE 'transport' END;
    IF source.kind = 'driver' THEN
      person_id := source.personnel_id;
      SELECT jsonb_agg(CASE WHEN d.item->>'id' = person_id THEN d.item || request.proposal ELSE d.item END ORDER BY d.pos) INTO rows
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(changed->'journey'->'drivers') = 'array'
        THEN changed->'journey'->'drivers' ELSE jsonb_build_array(changed->'journey'->'driver') END) WITH ORDINALITY d(item,pos);
      changed := jsonb_set(changed #- '{journey,driver}', '{journey,drivers}', rows);
    ELSIF source.kind = 'owner' AND request.proposal ? 'kilometers' THEN
      changed := jsonb_set(changed, '{journey,kilometers}', request.proposal->'kilometers');
    ELSIF source.kind = 'person' AND request.proposal ? 'kilometers' THEN
      changed := jsonb_set(changed, '{trip,kilometers}', to_jsonb(request.proposal->>'kilometers')) || (request.proposal - 'kilometers');
    ELSIF source.kind = 'person' THEN
      changed := (changed - 'hours' - 'starts_at' - 'ends_at') || request.proposal;
    ELSE
      changed := changed || request.proposal;
    END IF;
    SELECT jsonb_agg(CASE WHEN r.item->>'id' = request.target_id THEN changed ELSE r.item END ORDER BY r.pos) INTO rows
      FROM jsonb_array_elements(details->field) WITH ORDINALITY r(item,pos);
    PERFORM set_config('app.accounting_event_write', request.event_id::text, true);
    UPDATE public.events SET project_details = jsonb_set(details, ARRAY[field], rows) WHERE id = request.event_id;
    PERFORM set_config('app.accounting_event_write', '', true);
  END IF;
  UPDATE public.accounting_work_corrections SET state = CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,
    review_note = coalesce(p_note,'') WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accounting_work_sources(uuid), public.accounting_my_work(),
  public.accounting_submit_claim_correction(uuid,integer,jsonb), public.accounting_submit_work_correction(uuid,text,text,jsonb,jsonb), public.accounting_review_work_correction(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_my_work(), public.accounting_submit_claim_correction(uuid,integer,jsonb), public.accounting_submit_work_correction(uuid,text,text,jsonb,jsonb),
  public.accounting_review_work_correction(uuid,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
