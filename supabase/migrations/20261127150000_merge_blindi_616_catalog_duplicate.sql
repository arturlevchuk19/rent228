DO $$
DECLARE
  duplicate_id constant uuid := 'ba722e4a-46e2-45fd-8f2e-98caf485c6f3';
  retained_id constant uuid := 'fc1c9b50-2360-4b62-bc04-164939c14068';
BEGIN
  PERFORM 1 FROM public.equipment_items WHERE id IN (duplicate_id, retained_id) ORDER BY id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.equipment_items WHERE id = duplicate_id) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.equipment_items
    WHERE id = duplicate_id AND name = 'Блиндер Blinder X2 LED-S16C IP'
      AND sku = 'LGT_EQP_BLD_LED' AND quantity = 8 AND coalesce(note, '') = '' AND photo_path IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.equipment_items
    WHERE id = retained_id AND name = 'Светодиодный прожектор SK Light Blindi 616 IP'
      AND sku = 'blinder' AND quantity = 8
  ) THEN
    RAISE EXCEPTION 'Unexpected Blindi catalog entries';
  END IF;

  -- The confirmed duplicate has no document, modification or composition references.
  IF EXISTS (SELECT 1 FROM public.budget_items WHERE equipment_id = duplicate_id)
    OR EXISTS (SELECT 1 FROM public.template_items WHERE equipment_id = duplicate_id)
    OR EXISTS (SELECT 1 FROM public.warehouse_specification_budget_items WHERE equipment_id = duplicate_id)
    OR EXISTS (SELECT 1 FROM public.equipment_modifications WHERE equipment_id = duplicate_id)
    OR EXISTS (SELECT 1 FROM public.modification_components WHERE component_equipment_id = duplicate_id)
    OR EXISTS (SELECT 1 FROM public.equipment_compositions WHERE parent_id = duplicate_id OR child_id = duplicate_id)
  THEN
    RAISE EXCEPTION 'References to the Blindi duplicate require review';
  END IF;

  UPDATE public.equipment_items
  SET note = concat_ws(E'\n', nullif(note, ''), 'Также: Blinder X2 LED-S16C IP (бывший артикул LGT_EQP_BLD_LED)'),
      attribute = coalesce(nullif(attribute, ''), 'LED'),
      updated_at = now()
  WHERE id = retained_id;

  DELETE FROM public.equipment_items WHERE id = duplicate_id;
END $$;
