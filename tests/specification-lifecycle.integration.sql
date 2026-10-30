-- Run after event-budgets.bootstrap.sql, the event_budgets migration, fixture
-- columns below, and 20261030000000_freeze_specification_on_confirmation.sql.
UPDATE public.events SET status='Запрос' WHERE id='22222222-2222-4222-8222-222222222222';
INSERT INTO public.event_budgets(event_id,name,is_primary) VALUES('22222222-2222-4222-8222-222222222222','Test budget',true);
INSERT INTO public.budget_items(id,event_id,budget_id,item_type,name,quantity,is_extra)
SELECT '33333333-3333-4333-8333-333333333331','22222222-2222-4222-8222-222222222222',id,'equipment','Additional category equipment',5,true
FROM public.event_budgets WHERE event_id='22222222-2222-4222-8222-222222222222';
INSERT INTO public.budget_items(id,event_id,budget_id,item_type,name,quantity,is_extra,parent_budget_item_id)
SELECT '33333333-3333-4333-8333-333333333332','22222222-2222-4222-8222-222222222222',id,'equipment','Child',2,true,'33333333-3333-4333-8333-333333333331'
FROM public.event_budgets WHERE event_id='22222222-2222-4222-8222-222222222222';
INSERT INTO public.budget_items(event_id,budget_id,item_type,name,quantity,is_extra)
SELECT '22222222-2222-4222-8222-222222222222',id,'work','Additional category work',3,true
FROM public.event_budgets WHERE event_id='22222222-2222-4222-8222-222222222222';
GRANT UPDATE,SELECT ON public.events TO authenticated;
SET ROLE authenticated;
SET test.specifications='0';
UPDATE public.events SET status='Подтверждено' WHERE id='22222222-2222-4222-8222-222222222222';
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.warehouse_specification_budget_items WHERE event_id='22222222-2222-4222-8222-222222222222')<>3 THEN RAISE EXCEPTION 'Incomplete snapshot'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.warehouse_specification_budget_items child JOIN public.warehouse_specification_budget_items parent ON parent.id=child.parent_budget_item_id WHERE child.name='Child' AND parent.name='Additional category equipment') THEN RAISE EXCEPTION 'Parent link lost'; END IF;
END $$;
UPDATE public.warehouse_specification_budget_items SET quantity=99,notes='manual',picked=true WHERE name='Additional category equipment';
UPDATE public.events SET status='Выполнено' WHERE id='22222222-2222-4222-8222-222222222222';
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.warehouse_specification_budget_items WHERE notes='manual' AND quantity=99 AND picked) THEN RAISE EXCEPTION 'Manual edits overwritten'; END IF; END $$;
UPDATE public.events SET status='Запрос' WHERE id='22222222-2222-4222-8222-222222222222';
CREATE FUNCTION public.test_snapshot_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test freeze failure'; END $$;
CREATE TRIGGER test_snapshot_failure BEFORE INSERT ON public.warehouse_specification_budget_items FOR EACH ROW EXECUTE FUNCTION public.test_snapshot_failure();
DO $$ BEGIN
 BEGIN
  UPDATE public.events SET status='Подтверждено' WHERE id='22222222-2222-4222-8222-222222222222';
  RAISE EXCEPTION 'Expected snapshot failure';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%test freeze failure%' THEN RAISE; END IF; END;
 IF (SELECT status FROM public.events WHERE id='22222222-2222-4222-8222-222222222222')<>'Запрос' THEN RAISE EXCEPTION 'Status was not rolled back'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.warehouse_specification_budget_items WHERE notes='manual' AND quantity=99) THEN RAISE EXCEPTION 'Snapshot was not rolled back'; END IF;
END $$;
SELECT 'PASS: atomic latest snapshot, extra categories/work, hierarchy, project-editor rights, preserve confirmed edits and rollback on failure' AS result;
