BEGIN;
ALTER TABLE public.warehouse_specification_budget_items
  ADD COLUMN IF NOT EXISTS excluded_child_keys text[] NOT NULL DEFAULT '{}';

-- Invoker rights preserve existing row access. Atomic array append avoids lost
-- exclusions when two users remove different children at the same time.
CREATE OR REPLACE FUNCTION public.exclude_specification_child(
  p_event_id uuid, p_parent_id uuid, p_child_key text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE affected integer;
BEGIN
  IF NOT public.app_can_access('specifications', 3)
     OR NOT public.app_can_work_specification(p_event_id) THEN
    RAISE EXCEPTION 'No permission to remove specification items';
  END IF;
  IF p_child_key IS NULL OR length(p_child_key) > 500 OR NOT (
    starts_with(p_child_key, p_parent_id::text || '-comp-') OR
    starts_with(p_child_key, p_parent_id::text || '-mod-') OR
    starts_with(p_child_key, p_parent_id::text || '-case-') OR
    starts_with(p_child_key, p_parent_id::text || '-kitcase-') OR
    starts_with(p_child_key, p_parent_id::text || '-podium-')
  ) THEN RAISE EXCEPTION 'Invalid child row'; END IF;

  UPDATE public.warehouse_specification_budget_items
    SET excluded_child_keys = CASE
      WHEN p_child_key = ANY(excluded_child_keys) THEN excluded_child_keys
      ELSE array_append(excluded_child_keys, p_child_key) END,
      updated_at = now()
    WHERE id = p_parent_id AND event_id = p_event_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Parent item not found or not accessible'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.exclude_specification_child(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exclude_specification_child(uuid, uuid, text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
