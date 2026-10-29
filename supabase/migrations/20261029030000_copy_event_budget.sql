BEGIN;
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
 RETURN new_budget_id;
END;
$$;
REVOKE ALL ON FUNCTION public.copy_event_budget(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_event_budget(uuid,uuid,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
