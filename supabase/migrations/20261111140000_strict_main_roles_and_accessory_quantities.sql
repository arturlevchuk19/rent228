BEGIN;

-- Being selected in the event is insufficient for a Technician: the selected
-- lead must also hold the site-lead role. Main and log access use the same rule.
CREATE OR REPLACE FUNCTION public.app_can_edit_main_specification(p_event uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.app_can_access('specifications',2) AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.status='active'
   AND (u.role IN ('superuser','admin') OR (u.role='foreman' AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id=p_event AND e.site_manager_id=u.id))));
$$;
CREATE OR REPLACE FUNCTION public.app_can_view_specification_logs(p_event uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.app_can_access('specifications',1) AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.status='active'
   AND (u.role IN ('superuser','admin') OR (u.role='foreman' AND EXISTS (
    SELECT 1 FROM public.events e WHERE e.id=p_event AND e.site_manager_id=u.id))));
$$;

CREATE OR REPLACE FUNCTION public.app_can_adjust_specification_accessories(p_event uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.app_can_access('specifications',1) AND EXISTS (
  SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.status='active'
   AND (u.role='staff' OR (public.app_can_access('specifications',2) AND public.app_can_work_specification(p_event))));
$$;
REVOKE ALL ON FUNCTION public.app_can_adjust_specification_accessories(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_can_adjust_specification_accessories(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_specification_accessory_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE shipped boolean; returned boolean; event_status text; row_data jsonb;
BEGIN
 IF (auth.uid() IS NULL AND auth.role() IS NULL) OR auth.role()='service_role' THEN RETURN NEW; END IF;
 IF public.app_can_access('specifications',2) AND public.app_can_work_specification(NEW.event_id) THEN RETURN NEW; END IF;
 IF NOT public.app_can_adjust_specification_accessories(NEW.event_id) THEN
  RAISE EXCEPTION 'No permission to adjust accessory quantities' USING ERRCODE='42501'; END IF;
 IF NEW.quantity IS NULL OR NEW.quantity<0 OR NEW.quantity<>floor(NEW.quantity) THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['quantity','picked','return_picked','updated_at']) IS DISTINCT FROM
                       (to_jsonb(OLD)-ARRAY['quantity','picked','return_picked','updated_at']) THEN
  RAISE EXCEPTION 'Only quantity and checkboxes may be changed' USING ERRCODE='42501'; END IF;
 SELECT e.status,coalesce((b.specification_state->>'equipment_shipped')::boolean,false),
        coalesce((b.specification_state->>'equipment_returned')::boolean,false)
 INTO event_status,shipped,returned FROM public.events e JOIN public.event_budgets b ON b.event_id=e.id
 WHERE e.id=NEW.event_id AND b.id=NEW.budget_id;
 IF event_status IS NULL OR event_status NOT IN ('Подтверждено','Выполнено') THEN
  RAISE EXCEPTION 'Confirm the event before adjusting accessories' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  row_data=to_jsonb(NEW);
  IF shipped OR coalesce(NEW.picked,false) OR coalesce(NEW.return_picked,false) OR coalesce(row_data->>'notes','')<>'' THEN
   RAISE EXCEPTION 'Only an unmarked quantity row can be added before shipment' USING ERRCODE='42501'; END IF;
 ELSE
  IF (NEW.quantity IS DISTINCT FROM OLD.quantity AND shipped)
   OR (NEW.picked IS DISTINCT FROM OLD.picked AND shipped)
   OR (NEW.return_picked IS DISTINCT FROM OLD.return_picked AND (NOT shipped OR returned)) THEN
   RAISE EXCEPTION 'Changes are not allowed at this shipment stage' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_specification_accessory_change() FROM PUBLIC;

DO $$ DECLARE target text; BEGIN
 FOREACH target IN ARRAY ARRAY['warehouse_specification_cables','warehouse_specification_connectors','warehouse_specification_other'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS account_insert ON public.%I',target);
  EXECUTE format('DROP POLICY IF EXISTS account_insert_guard ON public.%I',target);
  EXECUTE format('DROP POLICY IF EXISTS account_update ON public.%I',target);
  EXECUTE format('DROP POLICY IF EXISTS account_update_guard ON public.%I',target);
  EXECUTE format('CREATE POLICY account_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.app_can_adjust_specification_accessories(event_id))',target);
  EXECUTE format('CREATE POLICY account_insert_guard ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.app_can_adjust_specification_accessories(event_id))',target);
  EXECUTE format('CREATE POLICY account_update ON public.%I FOR UPDATE TO authenticated USING (public.app_can_adjust_specification_accessories(event_id)) WITH CHECK (public.app_can_adjust_specification_accessories(event_id))',target);
  EXECUTE format('CREATE POLICY account_update_guard ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.app_can_adjust_specification_accessories(event_id)) WITH CHECK (public.app_can_adjust_specification_accessories(event_id))',target);
  EXECUTE format('CREATE TRIGGER guard_specification_accessory_change BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_specification_accessory_change()',target);
 END LOOP;
END; $$;
NOTIFY pgrst,'reload schema';
COMMIT;
