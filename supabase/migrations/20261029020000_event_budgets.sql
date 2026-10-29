BEGIN;
ALTER TABLE public.warehouse_specification_budget_items ADD COLUMN IF NOT EXISTS component_selection text;
CREATE TABLE IF NOT EXISTS public.event_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  is_primary boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(settings) = 'object'),
  specification_state jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(specification_state) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, id),
  CHECK ((settings - ARRAY['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes']) = '{}'::jsonb),
  CHECK ((specification_state - ARRAY['equipment_shipped','equipment_shipped_at','equipment_returned','equipment_returned_at','specification_confirmed','specification_confirmed_at','specification_confirmed_by']) = '{}'::jsonb)
);
CREATE UNIQUE INDEX IF NOT EXISTS event_budgets_primary ON public.event_budgets(event_id) WHERE is_primary;
ALTER TABLE public.event_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_budgets_read ON public.event_budgets FOR SELECT TO authenticated USING (
 public.app_can_access('events',1) OR public.app_can_access('calendar',1) OR public.app_can_access('budgets',1) OR public.app_can_access('specifications',1));
CREATE POLICY event_budgets_insert ON public.event_budgets FOR INSERT TO authenticated WITH CHECK (public.app_can_access('budgets',2) AND (specification_state='{}'::jsonb OR (public.app_can_access('specifications',2) AND public.app_can_work_specification(event_id))));
CREATE POLICY event_budgets_update ON public.event_budgets FOR UPDATE TO authenticated
 USING (public.app_can_access('budgets',2) OR (public.app_can_access('specifications',2) AND public.app_can_work_specification(event_id)))
 WITH CHECK (public.app_can_access('budgets',2) OR (public.app_can_access('specifications',2) AND public.app_can_work_specification(event_id)));
CREATE POLICY event_budgets_delete ON public.event_budgets FOR DELETE TO authenticated USING (public.app_can_access('budgets',3));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_budgets TO authenticated;

-- Existing event-level budgets and warehouse data become one primary document.
INSERT INTO public.event_budgets(event_id, name, is_primary, settings, specification_state)
SELECT e.id, 'Основная смета', true,
 jsonb_build_object('discount_enabled',e.discount_enabled,'discount_percent',e.discount_percent,
 'discount2_enabled',e.discount2_enabled,'discount2_percent',e.discount2_percent,'budget_days',e.budget_days,
 'budget_totals_mode',e.budget_totals_mode,'budget_note',e.budget_note,'sticky_notes',e.sticky_notes),
 jsonb_build_object('equipment_shipped',e.equipment_shipped,'equipment_shipped_at',e.equipment_shipped_at,
 'equipment_returned',e.equipment_returned,'equipment_returned_at',e.equipment_returned_at,
 'specification_confirmed',e.specification_confirmed,'specification_confirmed_at',e.specification_confirmed_at,
 'specification_confirmed_by',e.specification_confirmed_by)
FROM public.events e WHERE EXISTS(SELECT 1 FROM public.budget_items b WHERE b.event_id=e.id)
 OR EXISTS(SELECT 1 FROM public.warehouse_specification_budget_items s WHERE s.event_id=e.id)
 OR EXISTS(SELECT 1 FROM public.warehouse_specification_cables s WHERE s.event_id=e.id)
 OR EXISTS(SELECT 1 FROM public.warehouse_specification_connectors s WHERE s.event_id=e.id)
 OR EXISTS(SELECT 1 FROM public.warehouse_specification_other s WHERE s.event_id=e.id)
ON CONFLICT (event_id) WHERE is_primary DO NOTHING;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['categories','locations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS budget_id uuid',t);
  EXECUTE format('UPDATE public.%I r SET budget_id=b.id FROM public.event_budgets b WHERE r.event_id=b.event_id AND b.is_primary AND r.budget_id IS NULL',t);
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY(event_id,budget_id) REFERENCES public.event_budgets(event_id,id) ON DELETE CASCADE',t,t||'_budget_scope_fk');
  EXECUTE format('CREATE INDEX %I ON public.%I(budget_id)',t||'_budget_scope_idx',t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.assign_event_budget() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.event_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.budget_id IS NULL THEN
   SELECT id INTO NEW.budget_id FROM public.event_budgets WHERE event_id=NEW.event_id ORDER BY is_primary DESC, created_at LIMIT 1;
   IF NEW.budget_id IS NULL THEN
     INSERT INTO public.event_budgets(event_id,name,is_primary) VALUES(NEW.event_id,'Основная смета',true)
      ON CONFLICT(event_id) WHERE is_primary DO UPDATE SET name=event_budgets.name RETURNING id INTO NEW.budget_id;
   END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_event_budget() FROM PUBLIC;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['budget_items','warehouse_specification_budget_items','warehouse_specification_cables','warehouse_specification_connectors','warehouse_specification_other'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS budget_id uuid',t);
  EXECUTE format('UPDATE public.%I r SET budget_id=b.id FROM public.event_budgets b WHERE r.event_id=b.event_id AND b.is_primary AND r.budget_id IS NULL',t);
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN budget_id SET NOT NULL',t);
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY(event_id,budget_id) REFERENCES public.event_budgets(event_id,id) ON DELETE CASCADE',t,t||'_budget_scope_fk');
  EXECUTE format('CREATE INDEX %I ON public.%I(budget_id)',t||'_budget_scope_idx',t);
  EXECUTE format('CREATE TRIGGER assign_event_budget BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.assign_event_budget()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['budget_items','warehouse_specification_budget_items'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE(budget_id,id)',t,t||'_budget_id_unique');
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY(budget_id,parent_budget_item_id) REFERENCES public.%I(budget_id,id) ON DELETE CASCADE',t,t||'_budget_parent_fk',t);
 END LOOP;
END $$;

CREATE TRIGGER assign_event_budget BEFORE INSERT ON public.categories FOR EACH ROW EXECUTE FUNCTION public.assign_event_budget();
CREATE TRIGGER assign_event_budget BEFORE INSERT ON public.locations FOR EACH ROW EXECUTE FUNCTION public.assign_event_budget();
CREATE OR REPLACE FUNCTION public.adopt_legacy_budget_catalog() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.is_primary THEN
  UPDATE public.categories SET budget_id=NEW.id WHERE event_id=NEW.event_id AND budget_id IS NULL;
  UPDATE public.locations SET budget_id=NEW.id WHERE event_id=NEW.event_id AND budget_id IS NULL;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.adopt_legacy_budget_catalog() FROM PUBLIC;
CREATE TRIGGER adopt_legacy_budget_catalog AFTER INSERT ON public.event_budgets FOR EACH ROW EXECUTE FUNCTION public.adopt_legacy_budget_catalog();
CREATE OR REPLACE FUNCTION public.guard_budget_catalog_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.category_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.categories c WHERE c.id=NEW.category_id AND ((c.event_id IS NOT NULL AND c.event_id<>NEW.event_id) OR (c.budget_id IS NOT NULL AND c.budget_id<>NEW.budget_id))) THEN RAISE EXCEPTION 'Category belongs to another budget'; END IF;
 IF NEW.location_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.locations l WHERE l.id=NEW.location_id AND (l.event_id<>NEW.event_id OR (l.budget_id IS NOT NULL AND l.budget_id<>NEW.budget_id))) THEN RAISE EXCEPTION 'Location belongs to another budget'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_budget_catalog_scope() FROM PUBLIC;
CREATE TRIGGER guard_budget_catalog_scope BEFORE INSERT OR UPDATE ON public.budget_items FOR EACH ROW EXECUTE FUNCTION public.guard_budget_catalog_scope();
CREATE TRIGGER guard_budget_catalog_scope BEFORE INSERT OR UPDATE ON public.warehouse_specification_budget_items FOR EACH ROW EXECUTE FUNCTION public.guard_budget_catalog_scope();

CREATE OR REPLACE FUNCTION public.guard_event_budget_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Cannot move a budget to another event'; END IF;
 IF (NEW.settings IS DISTINCT FROM OLD.settings OR NEW.name IS DISTINCT FROM OLD.name OR NEW.is_primary IS DISTINCT FROM OLD.is_primary) AND NOT public.app_can_access('budgets',2) THEN RAISE EXCEPTION 'No permission to edit budgets'; END IF;
 IF NEW.specification_state IS DISTINCT FROM OLD.specification_state AND NOT (public.app_can_access('specifications',2) AND public.app_can_work_specification(OLD.event_id)) THEN RAISE EXCEPTION 'No permission to edit specification'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_event_budget_update() FROM PUBLIC;
CREATE TRIGGER guard_event_budget_update BEFORE UPDATE ON public.event_budgets FOR EACH ROW EXECUTE FUNCTION public.guard_event_budget_update();

CREATE OR REPLACE FUNCTION public.update_event_budget_settings(p_event_id uuid,p_budget_id uuid,p_patch jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF NOT public.app_can_access('budgets',2) OR jsonb_typeof(p_patch) <> 'object' OR
 (p_patch - ARRAY['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes']) <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid budget settings'; END IF;
 UPDATE public.event_budgets SET settings=settings||p_patch WHERE id=p_budget_id AND event_id=p_event_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Budget not found or not accessible'; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.update_event_budget_specification(p_event_id uuid,p_budget_id uuid,p_patch jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF NOT (public.app_can_access('specifications',2) AND public.app_can_work_specification(p_event_id)) OR jsonb_typeof(p_patch) <> 'object' OR
 (p_patch - ARRAY['equipment_shipped','equipment_shipped_at','equipment_returned','equipment_returned_at','specification_confirmed','specification_confirmed_at','specification_confirmed_by']) <> '{}'::jsonb THEN RAISE EXCEPTION 'Invalid specification state'; END IF;
 UPDATE public.event_budgets SET specification_state=specification_state||p_patch WHERE id=p_budget_id AND event_id=p_event_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Budget not found or not accessible'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.update_event_budget_settings(uuid,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_event_budget_specification(uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_event_budget_settings(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_event_budget_specification(uuid,uuid,jsonb) TO authenticated;

-- Keep the old event-level pricing fields compatible with existing reports of the primary budget.
CREATE OR REPLACE FUNCTION public.mirror_primary_budget_settings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.is_primary AND NEW.settings IS DISTINCT FROM OLD.settings THEN
  UPDATE public.events e SET
   discount_enabled=coalesce((NEW.settings->>'discount_enabled')::boolean,e.discount_enabled),
   discount_percent=coalesce((NEW.settings->>'discount_percent')::numeric,e.discount_percent),
   discount2_enabled=coalesce((NEW.settings->>'discount2_enabled')::boolean,e.discount2_enabled),
   discount2_percent=coalesce((NEW.settings->>'discount2_percent')::numeric,e.discount2_percent),
   budget_days=coalesce((NEW.settings->>'budget_days')::integer,e.budget_days),
   budget_totals_mode=coalesce(NEW.settings->>'budget_totals_mode',e.budget_totals_mode),
   budget_note=coalesce(NEW.settings->>'budget_note',e.budget_note),
   sticky_notes=coalesce(NEW.settings->>'sticky_notes',e.sticky_notes)
  WHERE e.id=NEW.event_id;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.mirror_primary_budget_settings() FROM PUBLIC;
CREATE TRIGGER mirror_primary_budget_settings AFTER UPDATE ON public.event_budgets FOR EACH ROW EXECUTE FUNCTION public.mirror_primary_budget_settings();

CREATE OR REPLACE FUNCTION public.sync_event_progress() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 NEW.progress_budget_done := EXISTS(SELECT 1 FROM public.event_budgets WHERE event_id=NEW.id);
 NEW.progress_equipment_reserved := NEW.status IN ('Подтверждено','Выполнено');
 NEW.progress_project_completed := NEW.status='Выполнено';
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_event_progress() FROM PUBLIC;
CREATE TRIGGER zz_sync_event_progress BEFORE INSERT OR UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.sync_event_progress();
CREATE OR REPLACE FUNCTION public.sync_event_budget_progress() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 UPDATE public.events SET progress_budget_done=EXISTS(SELECT 1 FROM public.event_budgets WHERE event_id=COALESCE(NEW.event_id,OLD.event_id)) WHERE id=COALESCE(NEW.event_id,OLD.event_id);
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_event_budget_progress() FROM PUBLIC;
CREATE TRIGGER sync_event_budget_progress AFTER INSERT OR DELETE ON public.event_budgets FOR EACH ROW EXECUTE FUNCTION public.sync_event_budget_progress();
UPDATE public.events SET progress_budget_done=EXISTS(SELECT 1 FROM public.event_budgets WHERE event_id=events.id), progress_equipment_reserved=status IN ('Подтверждено','Выполнено'), progress_project_completed=status='Выполнено';

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
  selected_budget uuid;
BEGIN
  IF cardinality(p_item_ids) IS NULL OR cardinality(p_item_ids) = 0
     OR cardinality(p_item_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_item_ids) AS ids(id)) THEN
    RAISE EXCEPTION 'Invalid component selection';
  END IF;

  SELECT budget_id INTO selected_budget FROM public.warehouse_specification_budget_items WHERE event_id=p_event_id AND id=ANY(p_item_ids) LIMIT 1;
  FOR item_id IN
    SELECT id FROM public.warehouse_specification_budget_items
    WHERE event_id = p_event_id AND id = ANY(p_item_ids) AND budget_id=selected_budget
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
    event_id, budget_id, item_type, equipment_id, category_id, location_id, name, sku,
    quantity, price, total, exchange_rate, notes, picked, return_picked,
    is_extra, sort_order, component_selection
  ) VALUES (
    p_event_id, selected_budget, 'equipment', NULL,
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


REVOKE ALL ON FUNCTION public.save_specification_component_choice(uuid,uuid[],jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_specification_component_choice(uuid,uuid[],jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
