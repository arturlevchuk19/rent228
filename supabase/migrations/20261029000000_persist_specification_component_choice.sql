BEGIN;

ALTER TABLE public.warehouse_specification_budget_items
  ADD COLUMN IF NOT EXISTS component_selection text;

-- Invoker rights keep the existing specification access policies in force.
-- One transaction records separate components or replaces the group with a case.
CREATE OR REPLACE FUNCTION public.save_specification_component_choice(
  p_event_id uuid,
  p_item_ids uuid[],
  p_case jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  matched integer := 0;
  item_id uuid;
BEGIN
  IF cardinality(p_item_ids) IS NULL OR cardinality(p_item_ids) = 0
     OR cardinality(p_item_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_item_ids) AS ids(id)) THEN
    RAISE EXCEPTION 'Invalid component selection';
  END IF;

  FOR item_id IN
    SELECT id FROM public.warehouse_specification_budget_items
    WHERE event_id = p_event_id AND id = ANY(p_item_ids)
      AND item_type = 'equipment' AND parent_budget_item_id IS NULL
    ORDER BY id FOR UPDATE
  LOOP
    matched := matched + 1;
  END LOOP;
  IF matched <> cardinality(p_item_ids) THEN
    RAISE EXCEPTION 'Components changed or are not accessible. Reload the specification.';
  END IF;

  IF p_case IS NULL THEN
    UPDATE public.warehouse_specification_budget_items
      SET component_selection = 'separate', updated_at = now()
      WHERE event_id = p_event_id AND id = ANY(p_item_ids);
    GET DIAGNOSTICS matched = ROW_COUNT;
    IF matched <> cardinality(p_item_ids) THEN RAISE EXCEPTION 'Cannot save component selection'; END IF;
    RETURN;
  END IF;

  IF jsonb_typeof(p_case) <> 'object' OR coalesce(p_case->>'name','') = ''
     OR coalesce((p_case->>'quantity')::numeric, 0) <= 0 THEN
    RAISE EXCEPTION 'Invalid case';
  END IF;

  INSERT INTO public.warehouse_specification_budget_items (
    event_id, item_type, equipment_id, category_id, location_id, name, sku,
    quantity, price, total, exchange_rate, notes, picked, return_picked,
    is_extra, sort_order, component_selection
  ) VALUES (
    p_event_id, 'equipment', NULL,
    (p_case->>'categoryId')::uuid, (p_case->>'locationId')::uuid,
    p_case->>'name', coalesce(p_case->>'sku',''), (p_case->>'quantity')::numeric,
    0, 0, 1, coalesce(p_case->>'notes',''),
    coalesce((p_case->>'picked')::boolean,false),
    coalesce((p_case->>'return_picked')::boolean,false),
    coalesce((p_case->>'isExtra')::boolean,false), 0, 'case'
  );

  DELETE FROM public.warehouse_specification_budget_items
    WHERE event_id = p_event_id AND id = ANY(p_item_ids);
  GET DIAGNOSTICS matched = ROW_COUNT;
  IF matched <> cardinality(p_item_ids) THEN RAISE EXCEPTION 'Cannot replace components'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_specification_component_choice(uuid, uuid[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_specification_component_choice(uuid, uuid[], jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
