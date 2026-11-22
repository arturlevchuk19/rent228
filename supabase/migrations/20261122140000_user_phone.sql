BEGIN;

ALTER TABLE public.users ADD COLUMN phone text
  CONSTRAINT users_phone_length CHECK (char_length(phone) <= 40);

CREATE FUNCTION public.account_update_profile(p_full_name text, p_phone text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.app_is_active() THEN RAISE EXCEPTION 'Войдите в активный аккаунт' USING ERRCODE = '42501'; END IF;
  IF length(btrim(p_full_name)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Укажите имя длиной до 120 символов'; END IF;
  UPDATE public.users SET full_name = btrim(p_full_name), phone = nullif(btrim(p_phone), '') WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.account_update_profile(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.account_update_profile(text,text) TO authenticated;

CREATE FUNCTION public.account_edit_user_details(p_target uuid, p_full_name text, p_role text, p_status text, p_personnel uuid, p_phone text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.users; target public.users; next_role public.users.role%TYPE; next_status public.users.status%TYPE;
BEGIN
 SELECT * INTO actor FROM public.users WHERE id=auth.uid() AND status='active';
 SELECT * INTO target FROM public.users WHERE id=p_target FOR UPDATE;
 IF actor.id IS NULL OR target.id IS NULL OR actor.id=target.id OR NOT public.app_can_access('users',2)
  OR public.app_role_rank(actor.role)<=public.app_role_rank(target.role) THEN RAISE EXCEPTION 'Недостаточно прав для редактирования пользователя' USING ERRCODE='42501'; END IF;
 IF length(btrim(p_full_name)) NOT BETWEEN 1 AND 120 OR p_full_name IS NULL OR p_status NOT IN ('active','inactive','pending') OR p_status IS NULL THEN RAISE EXCEPTION 'Укажите имя и допустимый статус'; END IF;
 IF p_role IS NULL OR NOT EXISTS(SELECT 1 FROM public.app_roles WHERE key::text=p_role) THEN RAISE EXCEPTION 'Недопустимая роль'; END IF;
 IF public.app_role_rank(actor.role)<=public.app_role_rank(p_role) THEN RAISE EXCEPTION 'Можно назначить только роль ниже своей' USING ERRCODE='42501'; END IF;
 IF actor.role<>'superuser' AND EXISTS(
  SELECT 1 FROM public.app_roles tr, public.app_roles ar, jsonb_each_text(tr.permissions) p
  WHERE tr.key::text=p_role AND ar.key=actor.role AND p.value::integer>COALESCE((ar.permissions->>p.key)::integer,0)
 ) THEN RAISE EXCEPTION 'Нельзя выдать права выше собственных' USING ERRCODE='42501'; END IF;
 -- Existing checked link operation also validates authority over the current role.
 PERFORM public.account_link_personnel(p_target,p_personnel);
 SELECT u.role,u.status INTO next_role,next_status FROM jsonb_populate_record(NULL::public.users,jsonb_build_object('role',p_role,'status',p_status)) u;
 UPDATE public.users SET full_name=btrim(p_full_name),phone=nullif(btrim(p_phone),''),role=next_role,status=next_status WHERE id=p_target;
 UPDATE auth.users SET raw_user_meta_data=COALESCE(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('full_name',btrim(p_full_name)) WHERE id=p_target;
END;
$$;
REVOKE ALL ON FUNCTION public.account_edit_user_details(uuid,text,text,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.account_edit_user_details(uuid,text,text,text,uuid,text) TO authenticated;

CREATE FUNCTION public.account_list_users() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.app_can_access('users', 1) THEN
    RAISE EXCEPTION 'Недостаточно прав для просмотра пользователей' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id', u.id, 'email', u.email, 'full_name', u.full_name, 'phone', u.phone,
    'role', u.role, 'status', u.status, 'created_at', u.created_at
  ) ORDER BY u.created_at) FROM public.users u), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.account_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_list_users() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
