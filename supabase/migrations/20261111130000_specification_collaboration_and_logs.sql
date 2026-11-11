BEGIN;

ALTER TABLE public.warehouse_specification_cables ADD COLUMN IF NOT EXISTS picked boolean NOT NULL DEFAULT false;
ALTER TABLE public.warehouse_specification_connectors ADD COLUMN IF NOT EXISTS picked boolean NOT NULL DEFAULT false;
ALTER TABLE public.warehouse_specification_other ADD COLUMN IF NOT EXISTS picked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.app_can_view_specification_logs(p_event uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.app_can_access('specifications',1) AND EXISTS (
   SELECT 1 FROM public.users u WHERE u.id=auth.uid() AND u.status='active'
     AND (u.role IN ('superuser','admin') OR EXISTS (
       SELECT 1 FROM public.events e WHERE e.id=p_event AND e.site_manager_id=u.id)));
$$;
REVOKE ALL ON FUNCTION public.app_can_view_specification_logs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_can_view_specification_logs(uuid) TO authenticated;

CREATE TABLE public.specification_row_marks (
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 budget_id uuid NOT NULL REFERENCES public.event_budgets(id) ON DELETE CASCADE,
 parent_id uuid NOT NULL REFERENCES public.warehouse_specification_budget_items(id) ON DELETE CASCADE,
 row_key text PRIMARY KEY CHECK (length(row_key)<=500),
 label text NOT NULL,
 picked boolean NOT NULL DEFAULT false,
 return_picked boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX specification_row_marks_budget ON public.specification_row_marks(budget_id);
ALTER TABLE public.specification_row_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specification_row_marks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.specification_row_marks TO authenticated;
CREATE POLICY marks_read ON public.specification_row_marks FOR SELECT TO authenticated USING (public.app_can_access('specifications',1));
-- No direct writes: the RPC checks parent scope, role and shipment stage, then
-- changes one field atomically so simultaneous issue/return edits cannot collide.
CREATE OR REPLACE FUNCTION public.set_specification_row_mark(
 p_event_id uuid,p_budget_id uuid,p_parent_id uuid,p_row_key text,p_field text,p_value boolean,p_label text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE parent public.warehouse_specification_budget_items; shipped boolean; returned boolean; event_status text; resolved_label text;
BEGIN
 IF p_field NOT IN ('picked','return_picked') OR p_field IS NULL OR p_value IS NULL
    OR p_row_key IS NULL OR length(p_row_key)>500 OR p_label IS NULL OR length(p_label)>1000 THEN
   RAISE EXCEPTION 'Invalid checkbox'; END IF;
 IF NOT (starts_with(p_row_key,p_parent_id::text||'-comp-') OR starts_with(p_row_key,p_parent_id::text||'-mod-')
   OR starts_with(p_row_key,p_parent_id::text||'-case-') OR starts_with(p_row_key,p_parent_id::text||'-kitcase-')
   OR starts_with(p_row_key,p_parent_id::text||'-podium-')) THEN RAISE EXCEPTION 'Invalid child row'; END IF;
 SELECT * INTO parent FROM public.warehouse_specification_budget_items
   WHERE id=p_parent_id AND event_id=p_event_id AND budget_id=p_budget_id FOR KEY SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Parent not found'; END IF;
 IF (coalesce(parent.is_extra,false) AND parent.source_budget_item_id IS NULL) THEN
   IF NOT (public.app_can_access('specifications',2) AND public.app_can_work_specification(p_event_id)) THEN
     RAISE EXCEPTION 'No permission to mark extra equipment' USING ERRCODE='42501'; END IF;
 ELSIF NOT public.app_can_mark_main_specification() THEN
   RAISE EXCEPTION 'No permission to mark main equipment' USING ERRCODE='42501';
 END IF;
 IF p_row_key = ANY(parent.excluded_child_keys) THEN RAISE EXCEPTION 'Child is excluded'; END IF;
 -- Resolve catalog children on the server: checkbox-only users cannot invent a
 -- row name or add arbitrary fake component actions to the audit history.
 IF starts_with(p_row_key,p_parent_id::text||'-comp-') THEN
   SELECT e.name INTO resolved_label FROM public.equipment_compositions c
     JOIN public.equipment_items e ON e.id=c.child_id
     WHERE c.parent_id=parent.equipment_id
       AND p_row_key=p_parent_id::text||'-comp-'||c.id::text||'-'||c.child_id::text;
   IF NOT FOUND THEN RAISE EXCEPTION 'Composition child not found'; END IF;
 ELSIF starts_with(p_row_key,p_parent_id::text||'-mod-') THEN
   SELECT e.name INTO resolved_label FROM public.modification_components c
     JOIN public.equipment_items e ON e.id=c.component_equipment_id
     WHERE c.modification_id=parent.modification_id
       AND p_row_key=p_parent_id::text||'-mod-'||c.id::text||'-'||c.component_equipment_id::text;
   IF NOT FOUND THEN RAISE EXCEPTION 'Modification child not found'; END IF;
 ELSE
   -- Calculated unsaved case/podium rows exist only in the editing user's view.
   IF NOT public.app_can_edit_main_specification(p_event_id) AND NOT
     (coalesce(parent.is_extra,false) AND parent.source_budget_item_id IS NULL
       AND public.app_can_access('specifications',2) AND public.app_can_work_specification(p_event_id)) THEN
     RAISE EXCEPTION 'Save calculated rows before marking them' USING ERRCODE='42501'; END IF;
   resolved_label=p_label;
 END IF;
 resolved_label=coalesce(nullif(resolved_label,''),'Компонент');
 SELECT e.status,coalesce((b.specification_state->>'equipment_shipped')::boolean,false),
   coalesce((b.specification_state->>'equipment_returned')::boolean,false)
   INTO event_status,shipped,returned FROM public.events e JOIN public.event_budgets b ON b.event_id=e.id
   WHERE e.id=p_event_id AND b.id=p_budget_id;
 IF NOT public.app_can_edit_main_specification(p_event_id) AND (event_status NOT IN ('Подтверждено','Выполнено') OR event_status IS NULL
    OR (p_field='picked' AND shipped) OR (p_field='return_picked' AND (NOT shipped OR returned))) THEN
   RAISE EXCEPTION 'Checkbox changes are not allowed at this shipment stage' USING ERRCODE='42501'; END IF;
 INSERT INTO public.specification_row_marks AS existing(event_id,budget_id,parent_id,row_key,label,picked,return_picked)
 VALUES(p_event_id,p_budget_id,p_parent_id,p_row_key,resolved_label,p_field='picked' AND p_value,p_field='return_picked' AND p_value)
 ON CONFLICT(row_key) DO UPDATE SET
   picked=CASE WHEN p_field='picked' THEN p_value ELSE existing.picked END,
   return_picked=CASE WHEN p_field='return_picked' THEN p_value ELSE existing.return_picked END,
   label=resolved_label,updated_at=now()
 WHERE existing.event_id=p_event_id AND existing.budget_id=p_budget_id AND existing.parent_id=p_parent_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_specification_row_mark(uuid,uuid,uuid,text,text,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_specification_row_mark(uuid,uuid,uuid,text,text,boolean,text) TO authenticated;

CREATE TABLE public.specification_activity (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id uuid NOT NULL,
 budget_id uuid NOT NULL,
 actor_id uuid,
 actor_name text NOT NULL,
 entity text NOT NULL,
 row_id text NOT NULL,
 row_name text NOT NULL,
 action text NOT NULL CHECK(action IN ('insert','update','delete')),
 changes jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX specification_activity_budget ON public.specification_activity(budget_id,id DESC);
ALTER TABLE public.specification_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.specification_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.specification_activity TO authenticated;
CREATE POLICY activity_read ON public.specification_activity FOR SELECT TO authenticated
USING(public.app_can_view_specification_logs(event_id));
-- Clients cannot insert, alter or delete audit history; the database records the
-- authenticated identity in the same transaction as the successful action.
CREATE OR REPLACE FUNCTION public.record_specification_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE before_row jsonb; after_row jsonb; row_data jsonb; delta jsonb; actor text; label text; event_key uuid; budget_key uuid;
BEGIN
 before_row=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 after_row=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 row_data=CASE WHEN TG_OP='DELETE' THEN before_row ELSE after_row END;
 event_key=(row_data->>'event_id')::uuid;
 budget_key=CASE WHEN TG_TABLE_NAME='event_budgets' THEN (row_data->>'id')::uuid ELSE (row_data->>'budget_id')::uuid END;
 IF TG_TABLE_NAME='event_budgets' THEN
   before_row=coalesce(before_row->'specification_state','{}'::jsonb);
   after_row=coalesce(after_row->'specification_state','{}'::jsonb);
 END IF;
 SELECT coalesce(jsonb_object_agg(k,jsonb_build_object('old',before_row->k,'new',after_row->k)),'{}'::jsonb)
 INTO delta FROM (SELECT jsonb_object_keys(before_row||after_row) AS k) keys
 WHERE k NOT IN ('id','event_id','budget_id','created_at','updated_at','label','row_key','parent_id')
   AND coalesce(before_row->k,'null'::jsonb) IS DISTINCT FROM coalesce(after_row->k,'null'::jsonb);
 IF delta='{}'::jsonb THEN RETURN NULL; END IF;
 -- A repeated idempotent checkbox request must not create a second action.
 IF TG_TABLE_NAME='specification_row_marks' AND TG_OP='INSERT' THEN
   delta=delta - 'picked' - 'return_picked';
   IF (row_data->>'picked')::boolean THEN delta=delta||jsonb_build_object('picked',jsonb_build_object('old',false,'new',true)); END IF;
   IF (row_data->>'return_picked')::boolean THEN delta=delta||jsonb_build_object('return_picked',jsonb_build_object('old',false,'new',true)); END IF;
   IF delta='{}'::jsonb THEN RETURN NULL; END IF;
 END IF;
 SELECT u.full_name INTO actor FROM public.users u WHERE u.id=auth.uid();
 label=coalesce(nullif(row_data->>'name',''),nullif(row_data->>'label',''),nullif(row_data->>'connector_item',''),nullif(row_data->>'item_type',''));
 IF label IS NULL AND row_data->>'equipment_id' IS NOT NULL THEN
   SELECT e.name INTO label FROM public.equipment_items e WHERE e.id=(row_data->>'equipment_id')::uuid;
 END IF;
 IF TG_TABLE_NAME='warehouse_specification_cables' THEN label=concat_ws(' ',row_data->>'cable_type',row_data->>'cable_length'); END IF;
 IF TG_TABLE_NAME='event_budgets' THEN label='Состояние спецификации'; END IF;
 INSERT INTO public.specification_activity(event_id,budget_id,actor_id,actor_name,entity,row_id,row_name,action,changes)
 VALUES(event_key,budget_key,auth.uid(),coalesce(nullif(actor,''),CASE WHEN auth.uid() IS NULL THEN 'Система' ELSE 'Пользователь' END),
 TG_TABLE_NAME,coalesce(row_data->>'row_key',row_data->>'id'),coalesce(label,'Позиция'),lower(TG_OP),delta);
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.record_specification_activity() FROM PUBLIC;
DO $$ DECLARE target text; BEGIN
 FOREACH target IN ARRAY ARRAY['warehouse_specification_budget_items','warehouse_specification_cables','warehouse_specification_connectors','warehouse_specification_other','specification_row_marks','event_budgets'] LOOP
   EXECUTE format('CREATE TRIGGER record_specification_activity AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.record_specification_activity()',target);
   IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') AND NOT EXISTS (
     SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=target) THEN
     EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',target);
   END IF;
 END LOOP;
END; $$;
NOTIFY pgrst,'reload schema';
COMMIT;
