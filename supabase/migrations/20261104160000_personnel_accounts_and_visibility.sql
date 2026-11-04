BEGIN;
ALTER TABLE public.personnel
 ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS show_in_budgets boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS personnel_account_user_id_unique ON public.personnel(account_user_id) WHERE account_user_id IS NOT NULL;
COMMENT ON COLUMN public.personnel.account_user_id IS 'Linked account; user_id still identifies the creator of the personnel row';
COMMENT ON COLUMN public.personnel.show_in_budgets IS 'Offer this person for new estimate and event assignments';
-- Account links are changed only by the authorized user administration RPC.
CREATE OR REPLACE FUNCTION public.guard_personnel_account_link() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF (TG_OP = 'INSERT' AND NEW.account_user_id IS NOT NULL) OR
    (TG_OP = 'UPDATE' AND NEW.account_user_id IS DISTINCT FROM OLD.account_user_id) THEN
  IF auth.role() IS NOT NULL AND auth.role() <> 'service_role' AND current_user <> pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='public.personnel'::regclass)) THEN
   -- Allow the FK to clear the link when its user is deleted.
   IF TG_OP = 'UPDATE' AND NEW.account_user_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.users WHERE id=OLD.account_user_id) THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'Account links must be managed in user administration' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_personnel_account_link ON public.personnel;
CREATE TRIGGER guard_personnel_account_link BEFORE INSERT OR UPDATE OF account_user_id ON public.personnel FOR EACH ROW EXECUTE FUNCTION public.guard_personnel_account_link();
CREATE OR REPLACE FUNCTION public.account_link_personnel(p_target uuid, p_personnel uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor public.users; target public.users;
BEGIN
 SELECT * INTO actor FROM public.users WHERE id=auth.uid() AND status='active';
 SELECT * INTO target FROM public.users WHERE id=p_target;
 IF actor.id IS NULL OR target.id IS NULL OR actor.id=target.id OR NOT public.app_can_access('users',2)
  OR public.app_role_rank(actor.role) <= public.app_role_rank(target.role) THEN RAISE EXCEPTION 'Недостаточно прав для связи пользователя с сотрудником' USING ERRCODE='42501'; END IF;
 IF actor.role <> 'superuser' AND EXISTS (
  SELECT 1 FROM public.app_roles tr, public.app_roles ar, jsonb_each_text(tr.permissions) p
  WHERE tr.key=target.role AND ar.key=actor.role AND p.value::integer > COALESCE((ar.permissions ->> p.key)::integer,0)
 ) THEN RAISE EXCEPTION 'Нельзя управлять пользователем с правами выше ваших' USING ERRCODE='42501'; END IF;
 -- Serialize all changes to a user's link. Lock personnel too to reject races.
 PERFORM 1 FROM public.users WHERE id=p_target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Пользователь не найден'; END IF;
 IF p_personnel IS NOT NULL THEN
  PERFORM 1 FROM public.personnel WHERE id=p_personnel AND (account_user_id IS NULL OR account_user_id=p_target) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Сотрудник не найден или уже связан с другим пользователем'; END IF;
 END IF;
 UPDATE public.personnel SET account_user_id=NULL WHERE account_user_id=p_target AND id IS DISTINCT FROM p_personnel;
 IF p_personnel IS NOT NULL THEN UPDATE public.personnel SET account_user_id=p_target WHERE id=p_personnel; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.account_link_personnel(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_link_personnel(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.account_list_personnel() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public.app_can_access('users',2) THEN RAISE EXCEPTION 'Недостаточно прав для выбора сотрудника' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'full_name',full_name,'employment_type',employment_type,'account_user_id',account_user_id,'show_in_budgets',show_in_budgets) ORDER BY full_name) FROM public.personnel),'[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.account_list_personnel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_list_personnel() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
