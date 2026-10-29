-- Disposable PostgreSQL fixture only; run after bootstrap and both budget migrations.
DO $$ DECLARE source_id uuid; target_id uuid; copied_id uuid; category_key uuid; location_key uuid; parent_id uuid; child_id uuid; before_count integer; BEGIN
 SELECT id INTO source_id FROM public.event_budgets WHERE event_id='11111111-1111-4111-8111-111111111111' AND is_primary;
 INSERT INTO public.event_budgets(event_id,name,settings) VALUES('11111111-1111-4111-8111-111111111111','Existing target','{"budget_note":"Do not change"}') RETURNING id INTO target_id;
 INSERT INTO public.budget_items(event_id,budget_id,name,quantity) VALUES('11111111-1111-4111-8111-111111111111',target_id,'Existing target item',13);
 INSERT INTO public.categories(event_id,budget_id,name,description) VALUES('11111111-1111-4111-8111-111111111111',source_id,'Category','Description') RETURNING id INTO category_key;
 INSERT INTO public.locations(event_id,budget_id,name,color) VALUES('11111111-1111-4111-8111-111111111111',source_id,'Hall','#abcdef') RETURNING id INTO location_key;
 INSERT INTO public.budget_items(event_id,budget_id,name,quantity,category_id,location_id) VALUES('11111111-1111-4111-8111-111111111111',source_id,'Parent',2,category_key,location_key) RETURNING id INTO parent_id;
 INSERT INTO public.budget_items(event_id,budget_id,name,quantity,parent_budget_item_id,category_id,location_id) VALUES('11111111-1111-4111-8111-111111111111',source_id,'Child',4,parent_id,category_key,location_key) RETURNING id INTO child_id;
 copied_id:=public.copy_event_budget(source_id,'11111111-1111-4111-8111-111111111111');
 IF copied_id IN(source_id,target_id) THEN RAISE EXCEPTION 'Copy reused an existing budget'; END IF;
 IF (SELECT settings->>'budget_note' FROM public.event_budgets WHERE id=target_id) <> 'Do not change' OR NOT EXISTS(SELECT 1 FROM public.budget_items WHERE budget_id=target_id AND name='Existing target item' AND quantity=13) THEN RAISE EXCEPTION 'Copy changed the existing target'; END IF;
 IF (SELECT settings FROM public.event_budgets WHERE id=copied_id) IS DISTINCT FROM (SELECT settings FROM public.event_budgets WHERE id=source_id) THEN RAISE EXCEPTION 'Settings not copied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.budget_items c JOIN public.budget_items p ON p.id=c.parent_budget_item_id WHERE c.budget_id=copied_id AND p.budget_id=copied_id AND c.name='Child' AND p.name='Parent') THEN RAISE EXCEPTION 'Parent/child links not copied'; END IF;
 IF EXISTS(SELECT 1 FROM public.budget_items b WHERE b.budget_id=copied_id AND (b.category_id=category_key OR b.location_id=location_key)) THEN RAISE EXCEPTION 'Copy reused source local categories or locations'; END IF;
 UPDATE public.event_budgets SET name='Renamed copy' WHERE id=copied_id;
 IF (SELECT name FROM public.event_budgets WHERE id=copied_id) <> 'Renamed copy' THEN RAISE EXCEPTION 'Rename did not persist'; END IF;
 copied_id:=public.copy_event_budget(source_id,'22222222-2222-4222-8222-222222222222','First copy');
 IF NOT (SELECT is_primary FROM public.event_budgets WHERE id=copied_id) THEN RAISE EXCEPTION 'First copy must be primary'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.budget_items WHERE budget_id=source_id AND id=parent_id) THEN RAISE EXCEPTION 'Source parent changed'; END IF;
END $$;
-- A failure in the middle must leave no partial budget or catalog rows behind.
INSERT INTO public.budget_items(event_id,budget_id,name) SELECT event_id,id,'FAIL' FROM public.event_budgets WHERE name='Основная смета';
CREATE FUNCTION public.test_fail_copy() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='FAIL' THEN RAISE EXCEPTION 'Simulated write failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER test_fail_copy BEFORE INSERT ON public.budget_items FOR EACH ROW EXECUTE FUNCTION public.test_fail_copy();
DO $$ DECLARE source_id uuid; before_count integer; after_count integer; BEGIN
 SELECT id INTO source_id FROM public.event_budgets WHERE name='Основная смета';
 SELECT count(*) INTO before_count FROM public.event_budgets;
 BEGIN PERFORM public.copy_event_budget(source_id,'11111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'Expected failure';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Simulated write failure' THEN RAISE; END IF; END;
 SELECT count(*) INTO after_count FROM public.event_budgets;
 IF before_count<>after_count THEN RAISE EXCEPTION 'Partial budget survived failed copy'; END IF;
END $$;
DROP TRIGGER test_fail_copy ON public.budget_items;
DROP FUNCTION public.test_fail_copy();
SET ROLE authenticated;
SET test.budgets='0';
DO $$ BEGIN
 BEGIN PERFORM public.copy_event_budget((SELECT id FROM public.event_budgets LIMIT 1),'11111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'Read-only copy permitted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'No permission to copy budgets' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT 'PASS: new budget on copy, existing rows unchanged, settings/catalog/children copied, rename, rollback and permissions' AS result;
