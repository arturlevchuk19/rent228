BEGIN;
ALTER TABLE public.equipment_items
 ADD COLUMN IF NOT EXISTS gross_weight_kg numeric(12,3) CHECK (gross_weight_kg >= 0);
COMMENT ON COLUMN public.equipment_items.weight_kg IS 'Net weight in kilograms';

ALTER TABLE public.event_budgets DROP CONSTRAINT event_budgets_settings_keys;
ALTER TABLE public.event_budgets ADD CONSTRAINT event_budgets_settings_keys CHECK (
 (settings - ARRAY['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes','budget_version','budget_payment_mode','budget_exchange_rate','show_nominal_consumption','show_max_consumption','show_net_weight','show_gross_weight','show_volume','budget_dynamic_coefficients','budget_coefficient_groups']) = '{}'::jsonb
);

CREATE OR REPLACE FUNCTION public.update_event_budget_settings(p_event_id uuid,p_budget_id uuid,p_patch jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF NOT public.app_can_access('budgets',2) OR jsonb_typeof(p_patch) <> 'object' OR
 (p_patch - ARRAY['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes','budget_version','budget_payment_mode','budget_exchange_rate','show_nominal_consumption','show_max_consumption','show_net_weight','show_gross_weight','show_volume','budget_dynamic_coefficients','budget_coefficient_groups']) <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid budget settings'; END IF;
 IF (p_patch ? 'show_nominal_consumption' AND jsonb_typeof(p_patch->'show_nominal_consumption') <> 'boolean') OR
    (p_patch ? 'show_max_consumption' AND jsonb_typeof(p_patch->'show_max_consumption') <> 'boolean') THEN RAISE EXCEPTION 'Invalid consumption visibility'; END IF;
 IF EXISTS (
  SELECT 1 FROM jsonb_each(p_patch) AS setting(key, value)
  WHERE key IN ('show_net_weight','show_gross_weight','show_volume') AND jsonb_typeof(value) <> 'boolean'
 ) THEN RAISE EXCEPTION 'Invalid weight or volume visibility'; END IF;
 IF p_patch ? 'budget_exchange_rate' AND (jsonb_typeof(p_patch->'budget_exchange_rate') <> 'number' OR round((p_patch->>'budget_exchange_rate')::numeric,2) <= 0) THEN RAISE EXCEPTION 'Invalid exchange rate'; END IF;
 IF p_patch ? 'budget_exchange_rate' THEN
  p_patch := jsonb_set(p_patch,'{budget_exchange_rate}',to_jsonb(round((p_patch->>'budget_exchange_rate')::numeric,2)));
 END IF;
 IF p_patch ? 'budget_dynamic_coefficients' AND jsonb_typeof(p_patch->'budget_dynamic_coefficients') <> 'boolean' THEN
  RAISE EXCEPTION 'Invalid dynamic coefficient mode';
 END IF;
 IF p_patch ? 'budget_coefficient_groups' THEN
  IF jsonb_typeof(p_patch->'budget_coefficient_groups') <> 'array' THEN RAISE EXCEPTION 'Invalid coefficient groups'; END IF;
  IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_patch->'budget_coefficient_groups') AS groups(entry)
   WHERE jsonb_typeof(entry) IS DISTINCT FROM 'object'
    OR jsonb_typeof(entry->'id') IS DISTINCT FROM 'string' OR trim(entry->>'id') = ''
    OR jsonb_typeof(entry->'name') IS DISTINCT FROM 'string' OR trim(entry->>'name') = ''
    OR CASE WHEN jsonb_typeof(entry->'coefficient') = 'number'
       THEN (entry->>'coefficient')::numeric < 0 ELSE true END
    OR coalesce(jsonb_typeof(entry->'color'),'missing') NOT IN ('null','string')
    OR (entry->>'color') !~* '^#[0-9a-f]{6}$'
    OR jsonb_typeof(entry->'itemIds') IS DISTINCT FROM 'array'
  ) THEN RAISE EXCEPTION 'Invalid coefficient group'; END IF;
  IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_patch->'budget_coefficient_groups') AS groups(entry)
   GROUP BY entry->>'id' HAVING count(*) > 1
  ) OR EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_patch->'budget_coefficient_groups') AS groups(entry)
   CROSS JOIN LATERAL jsonb_array_elements(entry->'itemIds') AS members(item)
   GROUP BY item HAVING jsonb_typeof(item) <> 'string' OR count(*) > 1
  ) THEN RAISE EXCEPTION 'Duplicate or invalid coefficient group membership'; END IF;
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
