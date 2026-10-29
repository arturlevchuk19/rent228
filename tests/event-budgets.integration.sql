-- Run after the bootstrap fixture, component-choice migration and event-budgets migration.
DO $$ DECLARE primary_id uuid; second_id uuid; count_rows integer; component_id uuid; BEGIN
 SELECT id INTO primary_id FROM public.event_budgets WHERE event_id='11111111-1111-4111-8111-111111111111' AND is_primary;
 IF primary_id IS NULL THEN RAISE EXCEPTION 'Legacy budget missing'; END IF;
 IF (SELECT settings->>'budget_note' FROM public.event_budgets WHERE id=primary_id) <> 'Legacy note' THEN RAISE EXCEPTION 'Legacy settings lost'; END IF;
 IF (SELECT count(*) FROM public.budget_items WHERE budget_id=primary_id) <> 2 THEN RAISE EXCEPTION 'Legacy rows lost'; END IF;
 IF EXISTS(SELECT 1 FROM public.event_budgets WHERE event_id='22222222-2222-4222-8222-222222222222') THEN RAISE EXCEPTION 'Empty event should have no budget'; END IF;
 INSERT INTO public.event_budgets(event_id,name) VALUES('11111111-1111-4111-8111-111111111111','Second budget') RETURNING id INTO second_id;
 INSERT INTO public.budget_items(event_id,budget_id,quantity) VALUES('11111111-1111-4111-8111-111111111111',second_id,7);
 INSERT INTO public.warehouse_specification_budget_items(event_id,budget_id,name) VALUES('11111111-1111-4111-8111-111111111111',second_id,'Second spec');
 PERFORM public.update_event_budget_settings('11111111-1111-4111-8111-111111111111',second_id,'{"budget_note":"Independent note","budget_days":3}');
 IF (SELECT settings->>'budget_note' FROM public.event_budgets WHERE id=primary_id) <> 'Legacy note' THEN RAISE EXCEPTION 'Cross-budget settings changed'; END IF;
 PERFORM public.update_event_budget_specification('11111111-1111-4111-8111-111111111111',second_id,'{"equipment_shipped":true}');
 IF (SELECT coalesce((specification_state->>'equipment_shipped')::boolean,false) FROM public.event_budgets WHERE id=primary_id) THEN RAISE EXCEPTION 'Cross-spec shipment flag changed'; END IF;
 BEGIN
  INSERT INTO public.budget_items(event_id,budget_id) VALUES('22222222-2222-4222-8222-222222222222',second_id);
  RAISE EXCEPTION 'Cross-event insert accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.budget_items(event_id,budget_id,parent_budget_item_id) VALUES('11111111-1111-4111-8111-111111111111',second_id,'aaaaaaaa-1111-4111-8111-111111111111');
  RAISE EXCEPTION 'Cross-budget child accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 INSERT INTO public.warehouse_specification_budget_items(event_id,budget_id,name) VALUES('11111111-1111-4111-8111-111111111111',second_id,'Component') RETURNING id INTO component_id;
 PERFORM public.save_specification_component_choice('11111111-1111-4111-8111-111111111111',ARRAY[component_id],'{"name":"Replacement case","quantity":2}');
 IF NOT EXISTS(SELECT 1 FROM public.warehouse_specification_budget_items WHERE name='Replacement case' AND budget_id=second_id) THEN RAISE EXCEPTION 'Case moved to another specification'; END IF;
 BEGIN
  UPDATE public.event_budgets SET settings=settings||'{"status":"Выполнено"}'::jsonb WHERE id=second_id;
  RAISE EXCEPTION 'Unexpected settings keys accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 DELETE FROM public.event_budgets WHERE id=second_id;
 IF (SELECT count(*) FROM public.budget_items WHERE budget_id=primary_id) <> 2 THEN RAISE EXCEPTION 'Deleting second budget affected first'; END IF;
 IF NOT (SELECT progress_budget_done FROM public.events WHERE id='11111111-1111-4111-8111-111111111111') THEN RAISE EXCEPTION 'Progress cleared with remaining budget'; END IF;
 UPDATE public.events SET status='Выполнено' WHERE id='11111111-1111-4111-8111-111111111111';
 IF NOT (SELECT progress_project_completed AND progress_equipment_reserved FROM public.events WHERE id='11111111-1111-4111-8111-111111111111') THEN RAISE EXCEPTION 'Completed status progress incorrect'; END IF;
 UPDATE public.events SET status='Запрос' WHERE id='11111111-1111-4111-8111-111111111111';
 IF (SELECT progress_project_completed OR progress_equipment_reserved FROM public.events WHERE id='11111111-1111-4111-8111-111111111111') THEN RAISE EXCEPTION 'Reverse status progress incorrect'; END IF;
END $$;
SET ROLE authenticated;
SET test.budgets='0'; SET test.specifications='2';
DO $$ DECLARE budget_key uuid; BEGIN
 SELECT b.id INTO budget_key FROM public.event_budgets b LIMIT 1;
 PERFORM public.update_event_budget_specification('11111111-1111-4111-8111-111111111111',budget_key,'{"equipment_returned":true}');
 BEGIN
  UPDATE public.event_budgets SET name='Not allowed' WHERE event_budgets.id=budget_key;
  RAISE EXCEPTION 'Specification editor renamed budget';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Specification editor renamed budget' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.update_event_budget_settings('11111111-1111-4111-8111-111111111111',budget_key,'{"budget_note":"Not allowed"}');
  RAISE EXCEPTION 'Specification editor changed pricing settings';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Specification editor changed pricing settings' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DELETE FROM public.event_budgets;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.events WHERE progress_budget_done) THEN RAISE EXCEPTION 'Last budget deletion did not clear progress'; END IF;
END $$;
SELECT 'PASS: backfill, independent budgets/specifications/settings, FK isolation, progress both ways and access guards' AS result;
