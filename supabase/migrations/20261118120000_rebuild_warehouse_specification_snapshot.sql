BEGIN;

CREATE FUNCTION public.rebuild_warehouse_specification_snapshot(
  p_event_id uuid,
  p_budget_id uuid,
  p_reset boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT public.app_can_edit_main_specification(p_event_id)
     OR (p_reset AND NOT public.app_can_access('specifications', 3)) THEN
    RAISE EXCEPTION 'No permission to rebuild specification' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_budget_id::text, 0));

  IF NOT EXISTS (
    SELECT 1
    FROM public.event_budgets b
    JOIN public.events e ON e.id = b.event_id
    WHERE b.id = p_budget_id AND b.event_id = p_event_id
      AND e.status IN ('Подтверждено', 'Выполнено')
  ) THEN
    RAISE EXCEPTION 'No confirmed specification for this budget';
  END IF;

  IF p_reset THEN
    DELETE FROM public.warehouse_specification_budget_items
    WHERE event_id = p_event_id AND budget_id = p_budget_id;
  ELSIF EXISTS (
    SELECT 1 FROM public.warehouse_specification_budget_items
    WHERE event_id = p_event_id AND budget_id = p_budget_id
  ) THEN
    RETURN;
  END IF;

  -- Allocate all IDs first so the self-referencing foreign key can be
  -- resolved within one statement, including for nested positions.
  WITH source_rows AS MATERIALIZED (
    SELECT source.*, pg_catalog.gen_random_uuid() AS specification_id
    FROM public.budget_items source
    WHERE source.event_id = p_event_id AND source.budget_id = p_budget_id
  )
  INSERT INTO public.warehouse_specification_budget_items (
    id, event_id, budget_id, source_budget_item_id, parent_budget_item_id,
    item_type, equipment_id, modification_id, work_item_id, quantity, price,
    total, notes, exchange_rate, multi_day_rate_override, category_id, location_id,
    sort_order, picked, return_picked, is_extra, name, sku, created_at
  )
  SELECT
    source.specification_id, source.event_id, source.budget_id, source.id, parent.specification_id,
    source.item_type, source.equipment_id, source.modification_id, source.work_item_id,
    source.quantity, source.price, source.total, coalesce(source.notes, ''),
    coalesce(source.exchange_rate, 1), source.multi_day_rate_override, source.category_id,
    source.location_id, coalesce(source.sort_order, 0), coalesce(source.picked, false),
    coalesce(source.return_picked, false), coalesce(source.is_extra, false), source.name, source.sku,
    coalesce(source.created_at, now())
  FROM source_rows source
  LEFT JOIN source_rows parent ON parent.id = source.parent_budget_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_warehouse_specification_snapshot(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebuild_warehouse_specification_snapshot(uuid, uuid, boolean) TO authenticated;

COMMIT;
