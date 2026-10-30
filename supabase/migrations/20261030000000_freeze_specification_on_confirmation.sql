BEGIN;

-- Runs inside the status UPDATE: either every budget is captured, or the status
-- and all snapshots remain unchanged. Project editors need no warehouse delete right.
CREATE OR REPLACE FUNCTION public.freeze_specifications_on_confirmation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  budget record;
  ids jsonb;
BEGIN
  IF NEW.status NOT IN ('Подтверждено', 'Выполнено')
     OR OLD.status IN ('Подтверждено', 'Выполнено') THEN
    RETURN NEW;
  END IF;

  FOR budget IN SELECT id FROM public.event_budgets WHERE event_id = NEW.id ORDER BY id FOR UPDATE LOOP
    DELETE FROM public.warehouse_specification_budget_items
      WHERE event_id = NEW.id AND budget_id = budget.id;

    SELECT coalesce(jsonb_object_agg(id::text, gen_random_uuid()::text), '{}'::jsonb)
      INTO ids FROM public.budget_items WHERE event_id = NEW.id AND budget_id = budget.id;

    INSERT INTO public.warehouse_specification_budget_items (
      id, event_id, budget_id, source_budget_item_id, parent_budget_item_id,
      item_type, equipment_id, work_item_id, modification_id, quantity, price,
      total, notes, exchange_rate, multi_day_rate_override, category_id,
      location_id, sort_order, picked, return_picked, is_extra, name, sku
    )
    SELECT (ids->>source.id::text)::uuid, NEW.id, budget.id, source.id,
      (ids->>source.parent_budget_item_id::text)::uuid,
      source.item_type, source.equipment_id, source.work_item_id,
      source.modification_id, source.quantity, source.price, source.total,
      coalesce(source.notes, ''), coalesce(source.exchange_rate, 1),
      source.multi_day_rate_override, source.category_id, source.location_id,
      coalesce(source.sort_order, 0), false, false, coalesce(source.is_extra, false),
      source.name, source.sku
    FROM public.budget_items AS source
    WHERE source.event_id = NEW.id AND source.budget_id = budget.id;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.freeze_specifications_on_confirmation() FROM PUBLIC;

DROP TRIGGER IF EXISTS freeze_specifications_on_confirmation ON public.events;
CREATE TRIGGER freeze_specifications_on_confirmation
  AFTER UPDATE OF status ON public.events
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.freeze_specifications_on_confirmation();

COMMIT;
