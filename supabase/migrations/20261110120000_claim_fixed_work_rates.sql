BEGIN;
-- Primary selection is atomic: no transient loss visible outside this transaction.
CREATE OR REPLACE FUNCTION public.set_primary_event_budget(p_event uuid,p_budget uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.employee_claim_active() OR NOT public.app_can_access('budgets',2) THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.events WHERE id=p_event FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.event_budgets WHERE id=p_budget AND event_id=p_event) THEN RAISE EXCEPTION 'Смета не найдена'; END IF;
 UPDATE public.event_budgets SET is_primary=false WHERE event_id=p_event AND is_primary AND id<>p_budget;
 UPDATE public.event_budgets SET is_primary=true WHERE id=p_budget AND event_id=p_event;
END;
$$;
REVOKE ALL ON FUNCTION public.set_primary_event_budget(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_primary_event_budget(uuid,uuid) TO authenticated;

-- Only the per-performer price is used. Quantity never multiplies an employee's pay.
-- Repeated rows with different prices are ambiguous and require accountant review.
CREATE OR REPLACE FUNCTION public.employee_claim_fixed_rates(p_event uuid) RETURNS TABLE(name text,amount numeric,budget_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH units AS (
 SELECT b.id budget_id,btrim(coalesce(w.name,i.name)) name,
 coalesce(nullif((b.settings->>'budget_exchange_rate')::numeric,0),nullif(i.exchange_rate,0),3) exchange,
 coalesce(b.settings->>'budget_payment_mode','usd') mode,
 i.price * CASE WHEN b.settings->>'budget_totals_mode'='combined_only'
 THEN 1+greatest(0,coalesce((b.settings->>'budget_days')::numeric,1)-1)*coalesce(i.multi_day_rate_override,0) ELSE 1 END price
 FROM public.event_budgets b JOIN public.budget_items i ON i.budget_id=b.id
 LEFT JOIN public.work_items w ON w.id=i.work_item_id
 WHERE b.event_id=p_event AND b.is_primary AND i.item_type='work' AND i.quantity>0
 ), converted AS (
 SELECT name,budget_id,CASE mode WHEN 'byn_cash' THEN ceil(price*exchange)
 WHEN 'byn_noncash' THEN ceil(price*exchange*CASE WHEN name ~* 'доставка оборудования|доставка персонала' THEN 1.25 ELSE 1.67 END)
 ELSE round(round(price,2)*exchange,2) END amount FROM units
 ) SELECT name,min(amount),budget_id FROM converted GROUP BY name,budget_id HAVING count(DISTINCT amount)=1;
$$;
REVOKE ALL ON FUNCTION public.employee_claim_fixed_rates(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.employee_claim_context(p_event uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.employee_claim_active() THEN RAISE EXCEPTION 'Нет доступа' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('works',(SELECT coalesce(jsonb_agg(name ORDER BY CASE lower(name) WHEN 'загрузка' THEN 0 WHEN 'монтаж' THEN 1 WHEN 'демонтаж' THEN 2 WHEN 'разгрузка' THEN 3 ELSE 4 END,name),'[]') FROM public.employee_claim_works(p_event)),
 'fixed_rates',(SELECT coalesce(jsonb_object_agg(name,amount),'{}') FROM public.employee_claim_fixed_rates(p_event)),
 'budget_name',(SELECT name FROM public.event_budgets WHERE event_id=p_event AND is_primary));
END;
$$;
CREATE OR REPLACE FUNCTION public.employee_claim_save(p_id uuid,p_event uuid,p_lines jsonb,p_submit boolean,p_revision integer DEFAULT NULL,p_personnel uuid DEFAULT NULL,p_note text DEFAULT '') RETURNS public.employee_claims
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE manager boolean; owner_id uuid; person public.personnel; ev public.events; old public.employee_claims; saved public.employee_claims;
 row jsonb; output jsonb='[]'; kind text; work text; rate numeric; amount numeric; wage numeric=0; expense numeric=0;
 start_at timestamptz; end_at timestamptz; minutes numeric; pause numeric; fixed_budget uuid; km numeric; path text; idx integer=0; first_row jsonb; settings public.employee_claim_settings;
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
   start_at=(row->>'starts_at')::timestamptz;end_at=(row->>'ends_at')::timestamptz;pause=0;
   IF start_at IS NULL OR end_at IS NULL OR end_at<=start_at OR end_at>clock_timestamp() OR date_trunc('minute',start_at)<>start_at OR date_trunc('minute',end_at)<>end_at THEN RAISE EXCEPTION 'Проверьте начало и окончание работы'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(output) x WHERE x->>'kind'='time' AND tstzrange((x->>'starts_at')::timestamptz,(x->>'ends_at')::timestamptz,'[)') && tstzrange(start_at,end_at,'[)')) OR EXISTS(
    SELECT 1 FROM public.employee_claims c CROSS JOIN LATERAL jsonb_array_elements(c.lines) x WHERE c.personnel_id=person.id AND c.id IS DISTINCT FROM p_id AND c.state IN('submitted','approved','paid') AND x->>'kind'='time' AND tstzrange((x->>'starts_at')::timestamptz,(x->>'ends_at')::timestamptz,'[)') && tstzrange(start_at,end_at,'[)')) THEN RAISE EXCEPTION 'Время пересекается с другой работой сотрудника'; END IF;
   minutes=extract(epoch FROM end_at-start_at)/60;
   fixed_budget=NULL;
   IF lower(work) IN('монтаж','демонтаж') THEN
    rate=person.installation_rate;
    IF manager AND row ? 'rate' THEN rate=(row->>'rate')::numeric; END IF;
    rate=round(rate,2);amount=round(rate*minutes/60,2);
   ELSE
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(output) x WHERE x->>'kind'='time' AND x->>'work_name'=work) THEN RAISE EXCEPTION 'Фиксированную работу «%» можно указать только один раз в заявке',work; END IF;
    SELECT r.amount,r.budget_id INTO amount,fixed_budget FROM public.employee_claim_fixed_rates(p_event) r WHERE r.name=work;
    IF manager AND row->>'calculation'='fixed' AND row ? 'amount' THEN amount=(row->>'amount')::numeric; END IF;
    IF amount IS NULL THEN RAISE EXCEPTION 'В основной смете нет однозначной цены для работы «%». Обратитесь к администратору.',work; END IF;
    amount=round(amount,2);rate=round(amount*60/minutes,2);
   END IF;
   first_row=jsonb_build_object('kind',kind,'work_name',work,'starts_at',start_at,'ends_at',end_at,'break_minutes',0,'minutes',minutes,'rate',rate,'amount',amount,
     'calculation',CASE WHEN lower(work) IN('монтаж','демонтаж') THEN 'hourly' ELSE 'fixed' END,'budget_id',fixed_budget);
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
CREATE OR REPLACE FUNCTION public.mirror_primary_budget_settings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.is_primary AND (NEW.settings IS DISTINCT FROM OLD.settings OR NOT OLD.is_primary) THEN
  UPDATE public.events e SET
   discount_enabled=coalesce((NEW.settings->>'discount_enabled')::boolean,e.discount_enabled),
   discount_percent=coalesce((NEW.settings->>'discount_percent')::numeric,e.discount_percent),
   discount2_enabled=coalesce((NEW.settings->>'discount2_enabled')::boolean,e.discount2_enabled),
   discount2_percent=coalesce((NEW.settings->>'discount2_percent')::numeric,e.discount2_percent),
   budget_days=coalesce((NEW.settings->>'budget_days')::integer,e.budget_days),
   budget_totals_mode=coalesce(NEW.settings->>'budget_totals_mode',e.budget_totals_mode),
   budget_note=coalesce(NEW.settings->>'budget_note',e.budget_note),
   sticky_notes=coalesce(NEW.settings->>'sticky_notes',e.sticky_notes)
  WHERE e.id=NEW.event_id;
 END IF;
 RETURN NEW;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
