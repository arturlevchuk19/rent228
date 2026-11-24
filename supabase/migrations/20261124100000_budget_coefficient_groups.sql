BEGIN;
-- Store dynamic coefficients and group membership in the budget settings.
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
 (settings - ARRAY['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes','budget_version','budget_payment_mode','budget_exchange_rate','show_nominal_consumption','show_max_consumption','budget_dynamic_coefficients','budget_coefficient_groups']) = '{}'::jsonb
);
CREATE OR REPLACE FUNCTION public.update_event_budget_settings(p_event_id uuid,p_budget_id uuid,p_patch jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF NOT public.app_can_access('budgets',2) OR jsonb_typeof(p_patch) <> 'object' OR
 (p_patch - ARRAY['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes','budget_version','budget_payment_mode','budget_exchange_rate','show_nominal_consumption','show_max_consumption','budget_dynamic_coefficients','budget_coefficient_groups']) <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid budget settings'; END IF;
 IF (p_patch ? 'show_nominal_consumption' AND jsonb_typeof(p_patch->'show_nominal_consumption') <> 'boolean') OR
    (p_patch ? 'show_max_consumption' AND jsonb_typeof(p_patch->'show_max_consumption') <> 'boolean') THEN RAISE EXCEPTION 'Invalid consumption visibility'; END IF;
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
    OR (entry->>'color') NOT IN ('#fef08a','#fdba74','#ef4444','#86efac','#7dd3fc','#c4b5fd')
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

-- Copies a complete budget into a new document. Any failure rolls back the new
-- budget, category/location copies and items together. Warehouse data starts fresh.
CREATE OR REPLACE FUNCTION public.copy_event_budget(
 p_source_budget_id uuid, p_target_event_id uuid, p_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
 source_budget public.event_budgets%ROWTYPE;
 new_budget_id uuid;
 new_id uuid;
 category_ids jsonb := '{}';
 location_ids jsonb := '{}';
 item_ids jsonb := '{}';
 row_data record;
BEGIN
 IF NOT public.app_can_access('budgets',2) THEN RAISE EXCEPTION 'No permission to copy budgets'; END IF;
 SELECT * INTO source_budget FROM public.event_budgets WHERE id=p_source_budget_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source budget not found or not accessible'; END IF;
 -- Serialize first-budget creation with other copies into this event.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_target_event_id::text,0));
 INSERT INTO public.event_budgets(event_id,name,is_primary,settings)
 VALUES(p_target_event_id,coalesce(nullif(trim(p_name),''),source_budget.name || ' (копия)'),
  NOT EXISTS(SELECT 1 FROM public.event_budgets WHERE event_id=p_target_event_id AND is_primary),source_budget.settings)
 RETURNING id INTO new_budget_id;

 FOR row_data IN SELECT * FROM public.categories WHERE event_id=source_budget.event_id AND budget_id=p_source_budget_id ORDER BY sort_order,id LOOP
  INSERT INTO public.categories(event_id,budget_id,name,description,is_template,sort_order)
  VALUES(p_target_event_id,new_budget_id,row_data.name,row_data.description,false,row_data.sort_order) RETURNING id INTO new_id;
  category_ids := category_ids || jsonb_build_object(row_data.id::text,new_id);
 END LOOP;
 FOR row_data IN SELECT * FROM public.locations WHERE event_id=source_budget.event_id AND budget_id=p_source_budget_id ORDER BY sort_order,id LOOP
  INSERT INTO public.locations(event_id,budget_id,name,color,sort_order)
  VALUES(p_target_event_id,new_budget_id,row_data.name,row_data.color,row_data.sort_order) RETURNING id INTO new_id;
  location_ids := location_ids || jsonb_build_object(row_data.id::text,new_id);
 END LOOP;
 FOR row_data IN
  WITH RECURSIVE tree AS (
   SELECT b.*,0 AS depth FROM public.budget_items b WHERE b.budget_id=p_source_budget_id AND b.parent_budget_item_id IS NULL
   UNION ALL
   SELECT b.*,tree.depth+1 FROM public.budget_items b JOIN tree ON b.parent_budget_item_id=tree.id WHERE b.budget_id=p_source_budget_id
  ) SELECT * FROM tree ORDER BY depth,sort_order,created_at,id
 LOOP
  INSERT INTO public.budget_items(event_id,budget_id,equipment_id,work_item_id,modification_id,parent_budget_item_id,
   item_type,quantity,price,total,notes,exchange_rate,multi_day_rate_override,category_id,location_id,sort_order,
   picked,return_picked,is_extra,name,sku,unit,marker_color)
  VALUES(p_target_event_id,new_budget_id,row_data.equipment_id,row_data.work_item_id,row_data.modification_id,
   (item_ids->>row_data.parent_budget_item_id::text)::uuid,
   row_data.item_type,row_data.quantity,row_data.price,row_data.total,row_data.notes,row_data.exchange_rate,row_data.multi_day_rate_override,
   coalesce((category_ids->>row_data.category_id::text)::uuid,row_data.category_id),
   (location_ids->>row_data.location_id::text)::uuid,row_data.sort_order,
   false,false,coalesce(row_data.is_extra,false),row_data.name,row_data.sku,row_data.unit,row_data.marker_color) RETURNING id INTO new_id;
  item_ids := item_ids || jsonb_build_object(row_data.id::text,new_id);
 END LOOP;
 IF (SELECT count(*) FROM public.budget_items WHERE budget_id=new_budget_id)
    <> (SELECT count(*) FROM public.budget_items WHERE budget_id=p_source_budget_id) THEN
  RAISE EXCEPTION 'Could not copy all parent/child items';
 END IF;
 -- A copied budget keeps each group and substitutes the newly created item IDs.
 IF source_budget.settings ? 'budget_coefficient_groups' THEN
  UPDATE public.event_budgets
  SET settings=jsonb_set(settings,'{budget_coefficient_groups}',(
   SELECT coalesce(jsonb_agg(jsonb_set(group_entry,'{itemIds}',(
    SELECT coalesce(jsonb_agg(item_ids->old_id ORDER BY item_position),'[]'::jsonb)
    FROM jsonb_array_elements_text(group_entry->'itemIds') WITH ORDINALITY AS members(old_id,item_position)
    WHERE item_ids ? old_id
   )) ORDER BY group_position),'[]'::jsonb)
   FROM jsonb_array_elements(source_budget.settings->'budget_coefficient_groups')
     WITH ORDINALITY AS groups(group_entry,group_position)
  ))
  WHERE id=new_budget_id;
 END IF;
 RETURN new_budget_id;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
