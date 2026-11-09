BEGIN;
CREATE TABLE public.employee_claim_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 driver_rate numeric(10,2) NOT NULL DEFAULT .25 CHECK(driver_rate>=0),
 car_rate numeric(10,2) NOT NULL DEFAULT .25 CHECK(car_rate>=0),
 fuel_rate numeric(10,2) NOT NULL DEFAULT .30 CHECK(fuel_rate>=0)
);
INSERT INTO public.employee_claim_settings(id) VALUES(true);
CREATE TABLE public.employee_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.users(id),
 personnel_id uuid NOT NULL REFERENCES public.personnel(id),
 employee_name text NOT NULL,
 event_id uuid REFERENCES public.events(id),
 event_name text NOT NULL,
 state text NOT NULL DEFAULT 'draft' CHECK(state IN('draft','submitted','approved','paid','rejected')),
 lines jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(lines)='array'),
 work_amount numeric(14,2) NOT NULL DEFAULT 0,
 expense_amount numeric(14,2) NOT NULL DEFAULT 0,
 total numeric(14,2) NOT NULL DEFAULT 0,
 review_note text NOT NULL DEFAULT '',
 submitted_at timestamptz, approved_at timestamptz, paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 revision integer NOT NULL DEFAULT 1,
 UNIQUE(personnel_id,event_id)
);
CREATE INDEX employee_claim_state_idx ON public.employee_claims(state,updated_at DESC);
CREATE TABLE public.employee_claim_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 claim_id uuid NOT NULL REFERENCES public.employee_claims(id),
 actor_id uuid NOT NULL REFERENCES public.users(id),
 action text NOT NULL, before_value jsonb, after_value jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.employee_claim_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND status='active');
$$;
CREATE FUNCTION public.employee_claim_deadline(p_start text,p_end text) RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
 RETURN greatest(nullif(p_start,'')::date, nullif(p_end,'')::date)+3;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;
END;
$$;
CREATE FUNCTION public.employee_claim_works(p_event uuid) RETURNS TABLE(name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH associated AS (
 SELECT w.name FROM public.budget_items b JOIN public.work_items w ON w.id=b.work_item_id WHERE b.event_id=p_event AND b.item_type='work'
 UNION SELECT row->>'name' FROM public.events e CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e.project_details->'people_works')='array' THEN e.project_details->'people_works' ELSE '[]'::jsonb END) row WHERE e.id=p_event
 ), raw AS (SELECT name FROM associated UNION SELECT name FROM public.work_items WHERE NOT EXISTS(SELECT 1 FROM associated)), expanded AS (
 SELECT CASE WHEN regexp_replace(lower(name),'[[:space:]]','','g') IN('монтаж/демонтаж','монтажидемонтаж','монтаж-демонтаж') THEN 'Монтаж' ELSE name END name FROM raw
 UNION SELECT 'Демонтаж' WHERE EXISTS(SELECT 1 FROM raw WHERE regexp_replace(lower(name),'[[:space:]]','','g') IN('монтаж/демонтаж','монтажидемонтаж','монтаж-демонтаж'))
 UNION VALUES('Загрузка'),('Разгрузка')
 ) SELECT DISTINCT btrim(name) FROM expanded WHERE btrim(name)<>'';
$$;
ALTER TABLE public.employee_claim_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_claim_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY claim_settings_read ON public.employee_claim_settings FOR SELECT TO authenticated USING(public.employee_claim_active());
CREATE POLICY claim_read ON public.employee_claims FOR SELECT TO authenticated USING(public.employee_claim_active() AND (user_id=auth.uid() OR public.app_can_access('payments',1)));
CREATE POLICY claim_history_read ON public.employee_claim_history FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.employee_claims c WHERE c.id=claim_id));
GRANT SELECT ON public.employee_claim_settings,public.employee_claims,public.employee_claim_history TO authenticated;
CREATE FUNCTION public.employee_claim_bootstrap() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE own public.personnel; result jsonb;
BEGIN
 IF NOT public.employee_claim_active() THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
 SELECT * INTO own FROM public.personnel WHERE account_user_id=auth.uid();
 SELECT jsonb_build_object('personnel',CASE WHEN own.id IS NULL THEN NULL ELSE jsonb_build_object('id',own.id,'full_name',own.full_name,'installation_rate',own.installation_rate,'warehouse_rate',own.warehouse_rate) END,
 'settings',(SELECT to_jsonb(s) FROM public.employee_claim_settings s),
 'people',CASE WHEN public.app_can_access('payments',2) THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'account_user_id',p.account_user_id,'installation_rate',p.installation_rate,'warehouse_rate',p.warehouse_rate) ORDER BY p.full_name),'[]') FROM public.personnel p WHERE p.account_user_id IS NOT NULL) ELSE '[]' END,
 'events',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',coalesce(nullif(e.name,''),e.event_type),'status',e.status,'event_date',e.event_date,'event_end_date',e.event_end_date,'deadline',public.employee_claim_deadline(e.event_date,e.event_end_date)) ORDER BY e.event_date DESC),'[]') FROM public.events e),
 'today',(clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date) INTO result;
 RETURN result;
END;
$$;
CREATE FUNCTION public.employee_claim_context(p_event uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.employee_claim_active() THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('works',(SELECT coalesce(jsonb_agg(name ORDER BY CASE lower(name) WHEN 'загрузка' THEN 0 WHEN 'монтаж' THEN 1 WHEN 'демонтаж' THEN 2 WHEN 'разгрузка' THEN 3 ELSE 4 END,name),'[]') FROM public.employee_claim_works(p_event)));
END;
$$;
CREATE FUNCTION public.employee_claim_save(p_id uuid,p_event uuid,p_lines jsonb,p_submit boolean,p_revision integer DEFAULT NULL,p_personnel uuid DEFAULT NULL,p_note text DEFAULT '') RETURNS public.employee_claims
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE manager boolean; owner_id uuid; person public.personnel; ev public.events; old public.employee_claims; saved public.employee_claims;
 row jsonb; output jsonb='[]'; kind text; work text; rate numeric; amount numeric; wage numeric=0; expense numeric=0;
 start_at timestamptz; end_at timestamptz; minutes numeric; pause numeric; km numeric; path text; idx integer=0; first_row jsonb; settings public.employee_claim_settings;
BEGIN
 IF NOT public.employee_claim_active() THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
 manager=public.app_can_access('payments',2);
 IF p_id IS NOT NULL THEN
  SELECT * INTO old FROM public.employee_claims WHERE id=p_id FOR UPDATE;
  IF old.id IS NULL AND p_revision IS NOT NULL THEN RAISE EXCEPTION 'Заявка недоступна' USING ERRCODE='42501'; END IF;
  IF old.id IS NOT NULL THEN
  IF old.user_id<>auth.uid() AND NOT manager THEN RAISE EXCEPTION 'Заявка недоступна' USING ERRCODE='42501'; END IF;
  IF p_revision IS DISTINCT FROM old.revision THEN RAISE EXCEPTION 'Заявка уже изменена. Обновите список.'; END IF;
  IF old.state='paid' OR (NOT manager AND old.state NOT IN('draft','rejected')) THEN RAISE EXCEPTION 'Отправленную или выплаченную заявку нельзя редактировать'; END IF;
  IF old.event_id IS DISTINCT FROM p_event THEN RAISE EXCEPTION 'Нельзя изменить мероприятие сохранённой заявки'; END IF;
  END IF;
 END IF;
 IF old.id IS NOT NULL THEN
  SELECT * INTO person FROM public.personnel WHERE id=old.personnel_id;
 ELSE
  SELECT * INTO person FROM public.personnel WHERE (manager AND p_personnel IS NOT NULL AND id=p_personnel) OR (p_personnel IS NULL AND account_user_id=auth.uid());
 END IF;
 owner_id=coalesce(old.user_id,person.account_user_id);
 IF person.id IS NULL OR owner_id IS NULL OR (NOT manager AND person.account_user_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Свяжите учётную запись с сотрудником в разделе пользователей'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(person.id::text,0));
 IF p_event IS NOT NULL THEN
 SELECT * INTO ev FROM public.events WHERE id=p_event FOR SHARE;
 IF ev.id IS NULL THEN RAISE EXCEPTION 'Мероприятие не найдено'; END IF;
 IF NOT manager AND (public.employee_claim_deadline(ev.event_date,ev.event_end_date) IS NULL OR (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date>public.employee_claim_deadline(ev.event_date,ev.event_end_date)) THEN
  RAISE EXCEPTION 'Срок подачи истёк: заявки принимаются до конца третьего дня после окончания мероприятия';
 END IF;
 END IF;
 IF manager AND old.id IS NOT NULL AND length(btrim(p_note))=0 THEN RAISE EXCEPTION 'Укажите причину изменения заявки'; END IF;
 IF p_submit IS NULL THEN RAISE EXCEPTION 'Укажите действие сохранения'; END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Добавьте от 1 до 100 позиций'; END IF;
 SELECT * INTO settings FROM public.employee_claim_settings WHERE id;
 FOR row IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  idx=idx+1; kind=row->>'kind';work=btrim(coalesce(row->>'work_name',''));path=coalesce(row->>'receipt_path','');
  IF p_event IS NULL AND kind IN('time','trip') THEN RAISE EXCEPTION 'Выберите мероприятие для работы или поездки'; END IF;
  IF kind IN('time','trip') AND NOT EXISTS(SELECT 1 FROM public.employee_claim_works(p_event) w WHERE w.name=work) AND NOT (manager AND old.id IS NOT NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(old.lines) x WHERE x->>'work_name'=work)) THEN RAISE EXCEPTION 'Работа отсутствует в мероприятии: %',work; END IF;
  IF kind='time' THEN
   IF work ~* 'доставк' THEN RAISE EXCEPTION 'Доставка рассчитывается по километражу'; END IF;
   start_at=(row->>'starts_at')::timestamptz;end_at=(row->>'ends_at')::timestamptz;pause=coalesce(nullif(row->>'break_minutes','')::numeric,0);
   IF start_at IS NULL OR end_at IS NULL OR end_at<=start_at OR end_at>clock_timestamp() OR date_trunc('minute',start_at)<>start_at OR date_trunc('minute',end_at)<>end_at OR pause<0 OR pause<>trunc(pause) OR pause*60>=extract(epoch FROM end_at-start_at) THEN RAISE EXCEPTION 'Проверьте начало, окончание и перерыв работы'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(output) x WHERE x->>'kind'='time' AND tstzrange((x->>'starts_at')::timestamptz,(x->>'ends_at')::timestamptz,'[)') && tstzrange(start_at,end_at,'[)')) OR EXISTS(
    SELECT 1 FROM public.employee_claims c CROSS JOIN LATERAL jsonb_array_elements(c.lines) x WHERE c.personnel_id=person.id AND c.id IS DISTINCT FROM p_id AND c.state IN('submitted','approved','paid') AND x->>'kind'='time' AND tstzrange((x->>'starts_at')::timestamptz,(x->>'ends_at')::timestamptz,'[)') && tstzrange(start_at,end_at,'[)')) THEN RAISE EXCEPTION 'Время пересекается с другой работой сотрудника'; END IF;
   minutes=extract(epoch FROM end_at-start_at)/60-pause;
   rate=CASE WHEN work ~* 'склад|загрузка|разгрузка' THEN person.warehouse_rate ELSE person.installation_rate END;
   IF manager AND row ? 'rate' THEN rate=(row->>'rate')::numeric; END IF;
   rate=round(rate,2);amount=round(rate*minutes/60,2);
   first_row=jsonb_build_object('kind',kind,'work_name',work,'starts_at',start_at,'ends_at',end_at,'break_minutes',pause,'minutes',minutes,'rate',rate,'amount',amount);
  ELSIF kind='trip' THEN
   IF work !~* 'доставк' THEN RAISE EXCEPTION 'Километраж доступен только для доставки'; END IF;
   km=(row->>'kilometers')::numeric;
   IF km IS NULL OR km<=0 OR km>100000 THEN RAISE EXCEPTION 'Укажите корректный километраж'; END IF;
   rate=settings.driver_rate+CASE WHEN coalesce((row->>'own_car')::boolean,false) THEN settings.car_rate ELSE 0 END+CASE WHEN coalesce((row->>'own_fuel')::boolean,false) THEN settings.fuel_rate ELSE 0 END;
   IF manager AND row ? 'rate' THEN rate=(row->>'rate')::numeric; END IF;
   rate=round(rate,2);amount=round(km*rate,2);
   first_row=jsonb_build_object('kind',kind,'work_name',work,'kilometers',km,'own_car',coalesce((row->>'own_car')::boolean,false),'own_fuel',coalesce((row->>'own_fuel')::boolean,false),'rate',rate,'amount',amount);
  ELSIF kind IN('expense','allowance') THEN
   amount=round((row->>'amount')::numeric,2);rate=NULL;
   IF amount IS NULL OR amount<=0 OR length(btrim(coalesce(row->>'description','')))=0 THEN RAISE EXCEPTION 'Укажите назначение и положительную сумму расхода'; END IF;
   IF kind='expense' AND (path='' OR split_part(path,'/',1)<>owner_id::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='claim-receipts' AND name=path)) THEN RAISE EXCEPTION 'Прикрепите фото чека хозрасхода'; END IF;
   IF kind='expense' AND (EXISTS(SELECT 1 FROM jsonb_array_elements(output) x WHERE x->>'receipt_path'=path) OR EXISTS(SELECT 1 FROM public.employee_claims c CROSS JOIN LATERAL jsonb_array_elements(c.lines) x WHERE c.id IS DISTINCT FROM p_id AND c.state IN('submitted','approved','paid') AND x->>'receipt_path'=path)) THEN RAISE EXCEPTION 'Этот чек уже включён в другую позицию или заявку'; END IF;
   first_row=jsonb_build_object('kind',kind,'description',left(row->>'description',2000),'receipt_path',path,'amount',amount);
  ELSE RAISE EXCEPTION 'Неизвестный тип позиции'; END IF;
  IF amount IS NULL OR amount<0 OR amount>10000000 OR (rate IS NOT NULL AND (rate<0 OR rate>100000)) THEN RAISE EXCEPTION 'Проверьте ставку и сумму'; END IF;
  IF kind IN('time','trip') THEN wage=wage+amount; ELSE expense=expense+amount; END IF;
  output=output||jsonb_build_array(first_row||jsonb_build_object('id',idx));
 END LOOP;
 IF old.id IS NULL THEN
  INSERT INTO public.employee_claims(id,user_id,personnel_id,employee_name,event_id,event_name,state,lines,work_amount,expense_amount,total,submitted_at,review_note)
  VALUES(coalesce(p_id,gen_random_uuid()),owner_id,person.id,person.full_name,ev.id,coalesce(nullif(ev.name,''),ev.event_type,'Хозрасходы'),CASE WHEN p_submit THEN 'submitted' ELSE 'draft' END,output,wage,expense,wage+expense,CASE WHEN p_submit THEN now() END,CASE WHEN manager THEN p_note ELSE '' END) RETURNING * INTO saved;
 ELSE
  UPDATE public.employee_claims SET lines=output,work_amount=wage,expense_amount=expense,total=wage+expense,state=CASE WHEN p_submit THEN 'submitted' ELSE 'draft' END,approved_at=NULL,submitted_at=CASE WHEN p_submit THEN now() ELSE submitted_at END,review_note=CASE WHEN manager THEN p_note ELSE review_note END,revision=revision+1,updated_at=clock_timestamp() WHERE id=old.id RETURNING * INTO saved;
 END IF;
 INSERT INTO public.employee_claim_history(claim_id,actor_id,action,before_value,after_value) VALUES(saved.id,auth.uid(),'save',CASE WHEN old.id IS NOT NULL THEN to_jsonb(old) END,to_jsonb(saved));
 RETURN saved;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Заявка на это мероприятие уже существует. Откройте её в списке.';
END;
$$;
CREATE FUNCTION public.employee_claim_review(p_id uuid,p_action text,p_revision integer,p_note text DEFAULT '') RETURNS public.employee_claims LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.employee_claims; saved public.employee_claims; deadline date;
BEGIN
 IF NOT public.employee_claim_active() THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
 SELECT * INTO old FROM public.employee_claims WHERE id=p_id FOR UPDATE;
 IF old.id IS NULL OR old.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Заявка уже изменена. Обновите список.'; END IF;
 IF p_action IS NULL THEN RAISE EXCEPTION 'Укажите действие'; END IF;
 IF p_action='withdraw' THEN
  SELECT public.employee_claim_deadline(event_date,event_end_date) INTO deadline FROM public.events WHERE id=old.event_id;
  IF old.user_id<>auth.uid() OR old.state NOT IN('submitted','rejected') OR (old.event_id IS NOT NULL AND (deadline IS NULL OR (clock_timestamp() AT TIME ZONE 'Europe/Minsk')::date>deadline)) THEN RAISE EXCEPTION 'Нельзя вернуть эту заявку в черновик'; END IF;
 ELSE
  IF NOT public.app_can_access('payments',2) THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
  IF (p_action='approve' AND old.state<>'submitted') OR (p_action='pay' AND old.state<>'approved') OR (p_action IN('reject','return') AND old.state NOT IN('submitted','approved')) OR p_action NOT IN('approve','pay','reject','return') THEN RAISE EXCEPTION 'Недопустимый переход состояния'; END IF;
  IF p_action IN('reject','return','pay') AND length(btrim(p_note))=0 THEN RAISE EXCEPTION 'Добавьте комментарий: причину изменения или реквизиты проведённой выплаты'; END IF;
 END IF;
 UPDATE public.employee_claims SET state=CASE p_action WHEN 'approve' THEN 'approved' WHEN 'pay' THEN 'paid' WHEN 'reject' THEN 'rejected' ELSE 'draft' END,
 approved_at=CASE WHEN p_action='approve' THEN now() WHEN p_action='pay' THEN approved_at ELSE NULL END,paid_at=CASE WHEN p_action='pay' THEN now() ELSE paid_at END,
 review_note=CASE WHEN p_action='withdraw' THEN review_note ELSE p_note END,revision=revision+1,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO saved;
 INSERT INTO public.employee_claim_history(claim_id,actor_id,action,before_value,after_value) VALUES(p_id,auth.uid(),p_action,to_jsonb(old),to_jsonb(saved));
 RETURN saved;
END;
$$;
CREATE FUNCTION public.employee_claim_set_rates(p_driver numeric,p_car numeric,p_fuel numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.employee_claim_active() OR NOT public.app_can_access('payments',2) THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
 IF least(p_driver,p_car,p_fuel)<0 OR greatest(p_driver,p_car,p_fuel)>100 OR p_driver IS NULL OR p_car IS NULL OR p_fuel IS NULL THEN RAISE EXCEPTION 'Проверьте тарифы'; END IF;
 UPDATE public.employee_claim_settings SET driver_rate=round(p_driver,2),car_rate=round(p_car,2),fuel_rate=round(p_fuel,2) WHERE id;
END;
$$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('claim-receipts','claim-receipts',false,8388608,ARRAY['image/jpeg','image/png','image/webp']);
CREATE POLICY claim_receipt_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='claim-receipts' AND public.employee_claim_active() AND (split_part(name,'/',1)=auth.uid()::text OR public.app_can_access('payments',1)));
CREATE POLICY claim_receipt_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='claim-receipts' AND public.employee_claim_active() AND (split_part(name,'/',1)=auth.uid()::text OR public.app_can_access('payments',2)));
-- Restrictive boundaries protect receipts even when older buckets have broad policies.
CREATE POLICY claim_receipt_isolation ON storage.objects AS RESTRICTIVE FOR SELECT TO public USING(bucket_id<>'claim-receipts' OR (public.employee_claim_active() AND (split_part(name,'/',1)=auth.uid()::text OR public.app_can_access('payments',1))));
CREATE POLICY claim_receipt_write_isolation ON storage.objects AS RESTRICTIVE FOR INSERT TO public WITH CHECK(bucket_id<>'claim-receipts' OR (public.employee_claim_active() AND (split_part(name,'/',1)=auth.uid()::text OR public.app_can_access('payments',2))));
CREATE POLICY claim_receipt_immutable_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO public USING(bucket_id<>'claim-receipts') WITH CHECK(bucket_id<>'claim-receipts');
CREATE POLICY claim_receipt_immutable_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO public USING(bucket_id<>'claim-receipts');
REVOKE ALL ON FUNCTION public.employee_claim_works(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.employee_claim_bootstrap(),public.employee_claim_context(uuid),public.employee_claim_save(uuid,uuid,jsonb,boolean,integer,uuid,text),public.employee_claim_review(uuid,text,integer,text),public.employee_claim_set_rates(numeric,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.employee_claim_bootstrap(),public.employee_claim_context(uuid),public.employee_claim_save(uuid,uuid,jsonb,boolean,integer,uuid,text),public.employee_claim_review(uuid,text,integer,text),public.employee_claim_set_rates(numeric,numeric,numeric) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
