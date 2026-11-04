DO $$
DECLARE actor_id uuid; target public.users; employee uuid; occupied uuid; denied boolean;
BEGIN
 SELECT id INTO actor_id FROM public.users WHERE status='active' AND role IN ('superuser','admin') ORDER BY public.app_role_rank(role) DESC LIMIT 1;
 SELECT * INTO target FROM public.users WHERE public.app_role_rank(role)<(SELECT public.app_role_rank(role) FROM public.users WHERE id=actor_id) ORDER BY created_at LIMIT 1;
 IF actor_id IS NULL OR target.id IS NULL THEN RAISE EXCEPTION 'Test needs an administrator and a lower-role user'; END IF;
 INSERT INTO public.personnel(user_id,full_name) VALUES(actor_id,'__edit_link_test__') RETURNING id INTO employee;
 INSERT INTO public.personnel(user_id,full_name,account_user_id) VALUES(actor_id,'__edit_occupied_test__',actor_id) RETURNING id INTO occupied;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role','authenticated')::text,true);
 PERFORM public.account_edit_user_details(target.id,'Тест имени',target.role::text,target.status::text,employee);
 IF (SELECT full_name FROM public.users WHERE id=target.id)<>'Тест имени' OR (SELECT account_user_id FROM public.personnel WHERE id=employee) IS DISTINCT FROM target.id THEN RAISE EXCEPTION 'Profile/link update failed'; END IF;
 denied:=false;
 BEGIN PERFORM public.account_edit_user_details(target.id,'Не должно сохраниться',target.role::text,target.status::text,occupied); EXCEPTION WHEN raise_exception THEN denied:=true; END;
 IF NOT denied OR (SELECT full_name FROM public.users WHERE id=target.id)<>'Тест имени' THEN RAISE EXCEPTION 'Occupied link must roll back the profile edit'; END IF;
 denied:=false;
 BEGIN PERFORM public.account_edit_user_details(target.id,'Другое имя','superuser',target.status::text,NULL); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Role escalation allowed'; END IF;
 denied:=false;
 BEGIN PERFORM public.account_edit_user_details(actor_id,'Сам себе','staff','active',NULL); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Self-management allowed'; END IF;
END;
$$;
