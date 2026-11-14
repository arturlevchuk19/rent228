-- Both modes now use the same catalog item. Preserve configured budget rows.
DO $$
DECLARE
  source_id constant uuid := '142bddf9-598c-43ee-8f18-ed55e20e3646';
  target_id constant uuid := '22c694d7-33a0-42ca-9f50-99293cc13b5c';
  budgets_before jsonb;
  specification_before jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.equipment_items WHERE id = source_id) THEN
    RETURN; -- Already merged, or a different catalog/environment.
  END IF;
  PERFORM 1 FROM public.equipment_items WHERE id IN (source_id, target_id) FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.equipment_items
    WHERE id = source_id AND name = 'П-образная фермовая конструкция с системой подъема')
    OR NOT EXISTS (SELECT 1 FROM public.equipment_items
    WHERE id = target_id AND name = 'П-образная фермовая конструкция') THEN
    RAISE EXCEPTION 'Unexpected U-shaped construction catalog entries';
  END IF;
  -- Never let catalog deletion cascade into a composition or modification.
  IF EXISTS (SELECT 1 FROM public.equipment_compositions WHERE parent_id = source_id OR child_id = source_id)
    OR EXISTS (SELECT 1 FROM public.equipment_modifications WHERE equipment_id = source_id)
    OR EXISTS (SELECT 1 FROM public.modification_components WHERE component_equipment_id = source_id)
    OR EXISTS (SELECT 1 FROM public.template_items WHERE equipment_id = source_id) THEN
    RAISE EXCEPTION 'Additional lifting construction references require review';
  END IF;
  SELECT coalesce(jsonb_object_agg(id::text, to_jsonb(b) - 'equipment_id' - 'updated_at'), '{}'::jsonb)
    INTO budgets_before FROM public.budget_items b WHERE equipment_id = source_id;
  SELECT coalesce(jsonb_object_agg(id::text, to_jsonb(s) - 'equipment_id' - 'updated_at'), '{}'::jsonb)
    INTO specification_before FROM public.warehouse_specification_budget_items s WHERE equipment_id = source_id;

  UPDATE public.budget_items SET equipment_id = target_id WHERE equipment_id = source_id;
  UPDATE public.warehouse_specification_budget_items SET equipment_id = target_id WHERE equipment_id = source_id;

  IF budgets_before IS DISTINCT FROM (
    SELECT coalesce(jsonb_object_agg(id::text, to_jsonb(b) - 'equipment_id' - 'updated_at'), '{}'::jsonb)
    FROM public.budget_items b WHERE budgets_before ? id::text AND equipment_id = target_id
  ) OR specification_before IS DISTINCT FROM (
    SELECT coalesce(jsonb_object_agg(id::text, to_jsonb(s) - 'equipment_id' - 'updated_at'), '{}'::jsonb)
    FROM public.warehouse_specification_budget_items s WHERE specification_before ? id::text AND equipment_id = target_id
  ) THEN
    RAISE EXCEPTION 'Configured construction data changed during catalog merge';
  END IF;
  DELETE FROM public.equipment_items WHERE id = source_id;
END $$;
