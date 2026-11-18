BEGIN;

CREATE FUNCTION public.reset_warehouse_specification_marks(p_event_id uuid, p_budget_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.app_can_edit_main_specification(p_event_id) THEN
    RAISE EXCEPTION 'No permission to reset specification marks' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.event_budgets b
  JOIN public.events e ON e.id = b.event_id
  WHERE b.id = p_budget_id AND b.event_id = p_event_id
    AND e.status IN ('Подтверждено', 'Выполнено')
    AND NOT coalesce((b.specification_state->>'equipment_shipped')::boolean, false)
  FOR SHARE OF b, e;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Specification marks can only be reset before shipment';
  END IF;

  UPDATE public.warehouse_specification_budget_items
  SET picked = false, return_picked = false, updated_at = now()
  WHERE event_id = p_event_id AND budget_id = p_budget_id AND (picked OR return_picked);

  UPDATE public.warehouse_specification_cables
  SET picked = false, return_picked = false, updated_at = now()
  WHERE event_id = p_event_id AND budget_id = p_budget_id AND (picked OR return_picked);

  UPDATE public.warehouse_specification_connectors
  SET picked = false, return_picked = false, updated_at = now()
  WHERE event_id = p_event_id AND budget_id = p_budget_id AND (picked OR return_picked);

  UPDATE public.warehouse_specification_other
  SET picked = false, return_picked = false, updated_at = now()
  WHERE event_id = p_event_id AND budget_id = p_budget_id AND (picked OR return_picked);

  UPDATE public.specification_row_marks
  SET picked = false, return_picked = false, updated_at = now()
  WHERE event_id = p_event_id AND budget_id = p_budget_id AND (picked OR return_picked);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_warehouse_specification_marks(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_warehouse_specification_marks(uuid, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
