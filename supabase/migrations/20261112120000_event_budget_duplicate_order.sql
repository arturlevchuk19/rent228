BEGIN;
ALTER TABLE public.event_budgets ADD COLUMN sort_order bigint;
WITH ranked AS (
 SELECT id,row_number() OVER (PARTITION BY event_id ORDER BY is_primary DESC,created_at,id)-1 AS position
 FROM public.event_budgets
) UPDATE public.event_budgets b SET sort_order=ranked.position FROM ranked WHERE ranked.id=b.id;
ALTER TABLE public.event_budgets ALTER COLUMN sort_order SET NOT NULL;
CREATE INDEX event_budgets_sort_order ON public.event_budgets(event_id,sort_order);

CREATE OR REPLACE FUNCTION public.assign_event_budget_sort_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.event_id::text,0));
 IF NEW.sort_order IS NULL THEN
  SELECT coalesce(max(sort_order),-1)+1 INTO NEW.sort_order FROM public.event_budgets WHERE event_id=NEW.event_id;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_event_budget_sort_order() FROM PUBLIC;
CREATE TRIGGER assign_event_budget_sort_order BEFORE INSERT ON public.event_budgets
FOR EACH ROW EXECUTE FUNCTION public.assign_event_budget_sort_order();

CREATE OR REPLACE FUNCTION public.guard_event_budget_sort_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.sort_order IS DISTINCT FROM OLD.sort_order AND NOT (
  (auth.uid() IS NULL AND auth.role() IS NULL) OR coalesce(auth.role()='service_role',false) OR public.app_can_access('budgets',2)
 ) THEN RAISE EXCEPTION 'No permission to reorder budgets' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_event_budget_sort_order() FROM PUBLIC;
CREATE TRIGGER guard_event_budget_sort_order BEFORE UPDATE OF sort_order ON public.event_budgets
FOR EACH ROW EXECUTE FUNCTION public.guard_event_budget_sort_order();

-- Copy and placement form one transaction; the existing copier retains its
-- catalog/parent-child remapping and never copies warehouse checkmarks/state.
CREATE OR REPLACE FUNCTION public.duplicate_event_budget(p_source_budget_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE source_budget public.event_budgets; new_id uuid; position bigint; copy_name text; suffix integer:=1;
BEGIN
 IF NOT public.app_can_access('budgets',2) THEN RAISE EXCEPTION 'No permission to copy budgets'; END IF;
 SELECT * INTO source_budget FROM public.event_budgets WHERE id=p_source_budget_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source budget not found or not accessible'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(source_budget.event_id::text,0));
 -- Normalize to the currently displayed order, including a changed primary budget.
 WITH ranked AS (
  SELECT id,row_number() OVER (ORDER BY is_primary DESC,sort_order,created_at,id)-1 AS position
  FROM public.event_budgets WHERE event_id=source_budget.event_id
 ) UPDATE public.event_budgets b SET sort_order=ranked.position FROM ranked WHERE ranked.id=b.id;
 SELECT sort_order INTO position FROM public.event_budgets WHERE id=p_source_budget_id FOR UPDATE;
 UPDATE public.event_budgets SET sort_order=sort_order+1 WHERE event_id=source_budget.event_id AND sort_order>position;
 copy_name=source_budget.name||' (копия)';
 WHILE EXISTS(SELECT 1 FROM public.event_budgets WHERE event_id=source_budget.event_id AND name=copy_name) LOOP
  suffix=suffix+1; copy_name=source_budget.name||' (копия '||suffix||')';
 END LOOP;
 new_id=public.copy_event_budget(p_source_budget_id,source_budget.event_id,copy_name);
 UPDATE public.event_budgets SET sort_order=position+1,is_primary=false WHERE id=new_id;
 RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.duplicate_event_budget(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_event_budget(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
