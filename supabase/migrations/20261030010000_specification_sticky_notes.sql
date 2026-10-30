BEGIN;
-- Extend only the specification-state key constraint; retain all access policies.
DO $$
DECLARE constraint_name text;
BEGIN
 FOR constraint_name IN
  SELECT conname FROM pg_constraint
  WHERE conrelid='public.event_budgets'::regclass AND contype='c'
    AND pg_get_constraintdef(oid) LIKE '%specification_state -%'
 LOOP
  EXECUTE format('ALTER TABLE public.event_budgets DROP CONSTRAINT %I', constraint_name);
 END LOOP;
END;
$$;
ALTER TABLE public.event_budgets ADD CONSTRAINT event_budgets_specification_state_keys CHECK (
 (specification_state - ARRAY['equipment_shipped','equipment_shipped_at','equipment_returned','equipment_returned_at','specification_confirmed','specification_confirmed_at','specification_confirmed_by','spec_sticky_notes']) = '{}'::jsonb
);
CREATE OR REPLACE FUNCTION public.update_event_budget_specification(p_event_id uuid,p_budget_id uuid,p_patch jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF NOT (public.app_can_access('specifications',2) AND public.app_can_work_specification(p_event_id)) OR jsonb_typeof(p_patch) <> 'object' OR
 (p_patch - ARRAY['equipment_shipped','equipment_shipped_at','equipment_returned','equipment_returned_at','specification_confirmed','specification_confirmed_at','specification_confirmed_by','spec_sticky_notes']) <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid specification state'; END IF;
 UPDATE public.event_budgets SET specification_state=specification_state||p_patch WHERE id=p_budget_id AND event_id=p_event_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Budget not found or not accessible'; END IF;
END;
$$;
COMMIT;
