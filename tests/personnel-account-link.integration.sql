-- Run after the migration inside a transaction, then roll back the fixtures.
DO $$
DECLARE actor_id uuid; target_id uuid; first_id uuid; second_id uuid; denied boolean;
BEGIN
 SELECT id INTO actor_id FROM public.users WHERE status='active' AND role IN ('superuser','admin') ORDER BY public.app_role_rank(role) DESC LIMIT 1;
 SELECT id INTO target_id FROM public.users WHERE public.app_role_rank(role)<(SELECT public.app_role_rank(role) FROM public.users WHERE id=actor_id) AND id<>actor_id ORDER BY created_at LIMIT 1;
 IF actor_id IS NULL OR target_id IS NULL THEN RAISE EXCEPTION 'Integration test needs an active administrator and a lower-role user'; END IF;
 INSERT INTO public.personnel(user_id,full_name) VALUES(actor_id,'__personnel_link_test_one__') RETURNING id INTO first_id;
 INSERT INTO public.personnel(user_id,full_name) VALUES(actor_id,'__personnel_link_test_two__') RETURNING id INTO second_id;
 IF NOT (SELECT show_in_budgets FROM public.personnel WHERE id=first_id) THEN RAISE EXCEPTION 'Visibility must default to true'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role','authenticated')::text,true);
 PERFORM public.account_link_personnel(target_id,first_id);
 IF (SELECT account_user_id FROM public.personnel WHERE id=first_id) IS DISTINCT FROM target_id THEN RAISE EXCEPTION 'Link failed'; END IF;
 IF (SELECT user_id FROM public.personnel WHERE id=first_id) IS DISTINCT FROM actor_id THEN RAISE EXCEPTION 'Creator was overwritten'; END IF;
 denied := false;
 BEGIN UPDATE public.personnel SET account_user_id=target_id WHERE id=second_id; EXCEPTION WHEN unique_violation THEN denied := true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Account must not link to two personnel rows'; END IF;
 PERFORM public.account_link_personnel(target_id,second_id);
 IF (SELECT account_user_id FROM public.personnel WHERE id=first_id) IS NOT NULL THEN RAISE EXCEPTION 'Old link not cleared'; END IF;
 UPDATE public.personnel SET account_user_id=actor_id WHERE id=first_id;
 denied := false;
 BEGIN PERFORM public.account_link_personnel(target_id,first_id); EXCEPTION WHEN raise_exception THEN denied := true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Occupied personnel row must be rejected'; END IF;
 IF (SELECT account_user_id FROM public.personnel WHERE id=second_id) IS DISTINCT FROM target_id THEN RAISE EXCEPTION 'Failed reassignment lost old link'; END IF;
 PERFORM public.account_link_personnel(target_id,NULL);
 IF (SELECT account_user_id FROM public.personnel WHERE id=second_id) IS NOT NULL THEN RAISE EXCEPTION 'Unlink failed'; END IF;
 denied := false;
 BEGIN PERFORM public.account_link_personnel(actor_id,second_id); EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Self-management must be rejected'; END IF;
 -- A normal authenticated update cannot bypass the checked RPC.
 denied := false;
 BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.personnel SET account_user_id=target_id WHERE id=second_id;
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 EXECUTE 'RESET ROLE';
 IF NOT denied THEN RAISE EXCEPTION 'Direct account-link mutation was allowed'; END IF;
 PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
 denied := false;
 BEGIN PERFORM public.account_list_personnel(); EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unauthenticated user can list account personnel'; END IF;
END;
$$;
