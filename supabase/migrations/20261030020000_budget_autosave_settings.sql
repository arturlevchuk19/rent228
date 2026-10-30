BEGIN;
-- Keep budget preferences and item exchange rates in one authorized transaction.
DO $$
DECLARE constraint_name text;
BEGIN
 FOR constraint_name IN SELECT conname FROM pg_constraint
  WHERE conrelid='public.event_budgets'::regclass AND contype='c'
   AND pg_get_constraintdef(oid) LIKE '%settings -%'
 LOOP EXECUTE format('ALTER TABLE public.event_budgets DROP CONSTRAINT %I', constraint_name); END LOOP;
END;
$$;
ALTER TABLE public.event_budgets ADD CONSTRAINT event_budgets_settings_keys CHECK (
 (settings - ARRAY['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes','budget_version','budget_payment_mode','budget_exchange_rate']) = '{}'::jsonb
);
CREATE OR REPLACE FUNCTION public.update_event_budget_settings(p_event_id uuid,p_budget_id uuid,p_patch jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF NOT public.app_can_access('budgets',2) OR jsonb_typeof(p_patch) <> 'object' OR
 (p_patch - ARRAY['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes','budget_version','budget_payment_mode','budget_exchange_rate']) <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid budget settings'; END IF;
 IF p_patch ? 'budget_exchange_rate' AND (jsonb_typeof(p_patch->'budget_exchange_rate') <> 'number' OR round((p_patch->>'budget_exchange_rate')::numeric,2) <= 0) THEN RAISE EXCEPTION 'Invalid exchange rate'; END IF;
 IF p_patch ? 'budget_exchange_rate' THEN
  p_patch := jsonb_set(p_patch,'{budget_exchange_rate}',to_jsonb(round((p_patch->>'budget_exchange_rate')::numeric,2)));
 END IF;
 UPDATE public.event_budgets SET settings=settings||p_patch WHERE id=p_budget_id AND event_id=p_event_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Budget not found or not accessible'; END IF;
 IF p_patch ? 'budget_exchange_rate' THEN
  UPDATE public.budget_items SET exchange_rate=(p_patch->>'budget_exchange_rate')::numeric, updated_at=now()
   WHERE event_id=p_event_id AND budget_id=p_budget_id
    AND exchange_rate IS DISTINCT FROM (p_patch->>'budget_exchange_rate')::numeric;
 END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
