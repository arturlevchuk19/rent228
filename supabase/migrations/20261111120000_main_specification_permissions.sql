BEGIN;

-- Main tab only. Cable/connector/other tables and extra equipment keep their policies.
CREATE OR REPLACE FUNCTION public.app_can_edit_main_specification(p_event uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.app_can_access('specifications', 2) AND EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status = 'active'
      AND (u.role IN ('superuser', 'admin') OR EXISTS (
        SELECT 1 FROM public.events e WHERE e.id = p_event AND e.site_manager_id = u.id
      ))
  );
$$;
CREATE OR REPLACE FUNCTION public.app_can_mark_main_specification() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.app_can_access('specifications', 1) AND EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status = 'active'
      AND (u.role = 'staff' OR public.app_can_access('specifications', 2))
  );
$$;
REVOKE ALL ON FUNCTION public.app_can_edit_main_specification(uuid), public.app_can_mark_main_specification() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_can_edit_main_specification(uuid), public.app_can_mark_main_specification() TO authenticated;

-- Existing restrictive policies also need the narrow checkbox exception: a
-- permissive policy alone cannot override the old level-2 restrictive policy.
DROP POLICY IF EXISTS account_update ON public.warehouse_specification_budget_items;
DROP POLICY IF EXISTS account_update_guard ON public.warehouse_specification_budget_items;
CREATE POLICY account_update ON public.warehouse_specification_budget_items FOR UPDATE TO authenticated
USING (
  (public.app_can_access('specifications', 2) AND public.app_can_work_specification(event_id))
  OR (NOT (coalesce(is_extra, false) AND source_budget_item_id IS NULL) AND public.app_can_mark_main_specification())
)
WITH CHECK (
  (public.app_can_access('specifications', 2) AND public.app_can_work_specification(event_id))
  OR (NOT (coalesce(is_extra, false) AND source_budget_item_id IS NULL) AND public.app_can_mark_main_specification())
);
CREATE POLICY account_update_guard ON public.warehouse_specification_budget_items AS RESTRICTIVE FOR UPDATE TO authenticated
USING (
  (public.app_can_access('specifications', 2) AND public.app_can_work_specification(event_id))
  OR (NOT (coalesce(is_extra, false) AND source_budget_item_id IS NULL) AND public.app_can_mark_main_specification())
)
WITH CHECK (
  (public.app_can_access('specifications', 2) AND public.app_can_work_specification(event_id))
  OR (NOT (coalesce(is_extra, false) AND source_budget_item_id IS NULL) AND public.app_can_mark_main_specification())
);

CREATE POLICY main_specification_insert_guard ON public.warehouse_specification_budget_items AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((coalesce(is_extra, false) AND source_budget_item_id IS NULL) OR public.app_can_edit_main_specification(event_id));
CREATE POLICY main_specification_delete_guard ON public.warehouse_specification_budget_items AS RESTRICTIVE FOR DELETE TO authenticated
USING ((coalesce(is_extra, false) AND source_budget_item_id IS NULL) OR public.app_can_edit_main_specification(event_id));

-- UPDATE policies select rows, while the trigger enforces which columns a
-- checkbox-only actor can change. Check both OLD and NEW to prevent reclassifying
-- a main row as extra equipment or moving it into another event/budget.
CREATE OR REPLACE FUNCTION public.guard_main_specification_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  shipped boolean;
  returned boolean;
  event_status text;
BEGIN
  IF (auth.uid() IS NULL AND auth.role() IS NULL) OR auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF coalesce(OLD.is_extra, false) AND OLD.source_budget_item_id IS NULL
     AND coalesce(NEW.is_extra, false) AND NEW.source_budget_item_id IS NULL THEN RETURN NEW; END IF;
  IF public.app_can_edit_main_specification(OLD.event_id)
     AND public.app_can_edit_main_specification(NEW.event_id) THEN RETURN NEW; END IF;
  IF NOT public.app_can_mark_main_specification()
     OR (to_jsonb(NEW) - ARRAY['picked','return_picked','updated_at']) IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['picked','return_picked','updated_at']) THEN
    RAISE EXCEPTION 'Only the assigned site lead or administrator may edit the main specification' USING ERRCODE = '42501';
  END IF;
  SELECT e.status, coalesce((b.specification_state->>'equipment_shipped')::boolean, false),
         coalesce((b.specification_state->>'equipment_returned')::boolean, false)
    INTO event_status, shipped, returned
    FROM public.events e JOIN public.event_budgets b ON b.event_id = e.id
    WHERE e.id = OLD.event_id AND b.id = OLD.budget_id;
  IF event_status IS NULL OR event_status NOT IN ('Подтверждено','Выполнено')
     OR (NEW.picked IS DISTINCT FROM OLD.picked AND shipped)
     OR (NEW.return_picked IS DISTINCT FROM OLD.return_picked AND (NOT shipped OR returned)) THEN
    RAISE EXCEPTION 'Checkbox changes are not allowed at this shipment stage' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_main_specification_update() FROM PUBLIC;
CREATE TRIGGER guard_main_specification_update BEFORE UPDATE ON public.warehouse_specification_budget_items
FOR EACH ROW EXECUTE FUNCTION public.guard_main_specification_update();
NOTIFY pgrst, 'reload schema';
COMMIT;
