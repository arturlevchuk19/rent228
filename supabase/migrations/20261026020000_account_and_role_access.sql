-- Account profile, fixed system roles with editable names/access, and server-side access checks.
BEGIN;
CREATE TABLE IF NOT EXISTS public.app_roles (
  key text PRIMARY KEY CHECK (key IN ('superuser','admin','foreman','clerk','staff','warehouse')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
  permissions jsonb NOT NULL CHECK (jsonb_typeof(permissions) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO public.app_roles(key, name, permissions) VALUES
('superuser', 'Владелец', '{"calendar":3,"events":3,"budgets":3,"specifications":3,"equipment":3,"contacts":3,"templates":3,"payments":3,"personnel-report":3,"staff":3,"dashboard":3,"logistics":3,"users":3,"roles":3,"settings":3}'::jsonb),
('admin', 'Администратор', '{"calendar":3,"events":3,"budgets":3,"specifications":3,"equipment":3,"contacts":3,"templates":3,"payments":3,"personnel-report":3,"staff":3,"dashboard":3,"logistics":3,"users":3,"roles":3,"settings":3}'::jsonb),
('foreman', 'Старший по площадке', '{"calendar":1,"events":2,"budgets":2,"specifications":2,"equipment":2,"contacts":0,"templates":0,"payments":0,"personnel-report":0,"staff":0,"dashboard":1,"logistics":2,"users":0,"roles":0,"settings":0}'::jsonb),
('clerk', 'Менеджер', '{"calendar":1,"events":2,"budgets":2,"specifications":1,"equipment":2,"contacts":0,"templates":0,"payments":0,"personnel-report":0,"staff":0,"dashboard":1,"logistics":2,"users":0,"roles":0,"settings":0}'::jsonb),
('staff', 'Техник', '{"calendar":1,"events":1,"budgets":0,"specifications":1,"equipment":1,"contacts":0,"templates":0,"payments":0,"personnel-report":0,"staff":0,"dashboard":1,"logistics":0,"users":0,"roles":0,"settings":0}'::jsonb),
('warehouse', 'Кладовщик', '{"calendar":1,"events":1,"budgets":0,"specifications":2,"equipment":1,"contacts":0,"templates":0,"payments":0,"personnel-report":0,"staff":0,"dashboard":1,"logistics":0,"users":0,"roles":0,"settings":0}'::jsonb)
ON CONFLICT (key) DO NOTHING;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.app_role_rank(p_role text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_role WHEN 'superuser' THEN 100 WHEN 'admin' THEN 80 WHEN 'foreman' THEN 60 WHEN 'clerk' THEN 40 WHEN 'staff' THEN 20 WHEN 'warehouse' THEN 10 ELSE 0 END;
$$;
CREATE OR REPLACE FUNCTION public.app_can_access(p_module text, p_level integer DEFAULT 1) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u JOIN public.app_roles r ON r.key = u.role
    WHERE u.id = auth.uid() AND u.status = 'active'
      AND (u.role = 'superuser' OR COALESCE((r.permissions ->> p_module)::integer, 0) >= p_level)
  );
$$;
CREATE OR REPLACE FUNCTION public.app_is_active() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'active');
$$;
REVOKE ALL ON FUNCTION public.app_can_access(text,integer), public.app_is_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_can_access(text,integer), public.app_is_active() TO authenticated;
DROP POLICY IF EXISTS account_roles_read ON public.app_roles;
CREATE POLICY account_roles_read ON public.app_roles FOR SELECT TO authenticated USING (public.app_is_active());
REVOKE ALL ON public.app_roles FROM anon, authenticated;
GRANT SELECT ON public.app_roles TO authenticated;
GRANT ALL ON public.app_roles TO service_role;

CREATE OR REPLACE FUNCTION public.account_save_role(p_key text, p_name text, p_permissions jsonb, p_expected_updated_at timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.users; actor_permissions jsonb; item record; expected_keys text[] := ARRAY['calendar','events','budgets','specifications','equipment','contacts','templates','payments','personnel-report','staff','dashboard','logistics','users','roles','settings'];
BEGIN
  SELECT * INTO actor FROM public.users WHERE id = auth.uid() AND status = 'active';
  IF actor.id IS NULL OR NOT public.app_can_access('roles',2) OR p_key = 'superuser' OR public.app_role_rank(actor.role) <= public.app_role_rank(p_key) THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения этой роли' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(p_name)) NOT BETWEEN 2 AND 80 OR jsonb_typeof(p_permissions) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_permissions)) <> cardinality(expected_keys) THEN
    RAISE EXCEPTION 'Некорректные настройки роли';
  END IF;
  SELECT permissions INTO actor_permissions FROM public.app_roles WHERE key = actor.role;
  FOR item IN SELECT * FROM jsonb_each_text(p_permissions) LOOP
    IF NOT (item.key = ANY(expected_keys)) OR item.value NOT IN ('0','1','2','3') THEN RAISE EXCEPTION 'Некорректный уровень доступа'; END IF;
    IF actor.role <> 'superuser' AND item.value::integer > COALESCE((actor_permissions ->> item.key)::integer,0) THEN RAISE EXCEPTION 'Нельзя выдать права выше собственных'; END IF;
  END LOOP;
  UPDATE public.app_roles SET name = btrim(p_name), permissions = p_permissions, updated_at = clock_timestamp()
  WHERE key = p_key AND updated_at = p_expected_updated_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'Роль уже изменена. Обновите настройки и повторите попытку.'; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.account_update_profile(p_full_name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.app_is_active() THEN RAISE EXCEPTION 'Войдите в активный аккаунт' USING ERRCODE = '42501'; END IF;
  IF length(btrim(p_full_name)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Укажите имя длиной до 120 символов'; END IF;
  UPDATE public.users SET full_name = btrim(p_full_name) WHERE id = auth.uid();
END;
$$;
CREATE OR REPLACE FUNCTION public.account_sync_email() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN UPDATE public.users SET email = NEW.email WHERE id = NEW.id; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS account_sync_email ON auth.users;
CREATE TRIGGER account_sync_email AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.account_sync_email();

CREATE OR REPLACE FUNCTION public.account_delete_user(p_target uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.users; target public.users;
BEGIN
  SELECT * INTO actor FROM public.users WHERE id = auth.uid() AND status = 'active';
  SELECT * INTO target FROM public.users WHERE id = p_target FOR UPDATE;
  IF actor.id IS NULL OR target.id IS NULL OR actor.id = target.id OR NOT public.app_can_access('users',3)
    OR public.app_role_rank(actor.role) <= public.app_role_rank(target.role) THEN RAISE EXCEPTION 'Недостаточно прав для удаления пользователя' USING ERRCODE = '42501'; END IF;
  IF actor.role <> 'superuser' AND EXISTS (
    SELECT 1 FROM public.app_roles tr, public.app_roles ar, jsonb_each_text(tr.permissions) p
    WHERE tr.key = target.role AND ar.key = actor.role AND p.value::integer > COALESCE((ar.permissions ->> p.key)::integer,0)
  ) THEN RAISE EXCEPTION 'Нельзя управлять пользователем с правами выше ваших' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.users WHERE id = p_target;
  DELETE FROM auth.users WHERE id = p_target;
END;
$$;
REVOKE ALL ON FUNCTION public.account_save_role(text,text,jsonb,timestamptz), public.account_update_profile(text), public.account_delete_user(uuid), public.account_sync_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.account_save_role(text,text,jsonb,timestamptz), public.account_update_profile(text), public.account_delete_user(uuid) TO authenticated;
-- Profile/role mutations use checked RPCs or the authenticated server function only.
REVOKE UPDATE, DELETE ON public.users FROM authenticated, anon;
DROP POLICY IF EXISTS account_users_read ON public.users;
CREATE POLICY account_users_read ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.app_can_access('users',1) OR (status = 'active' AND public.app_is_active()));
DROP POLICY IF EXISTS account_registration_guard ON public.users;
CREATE POLICY account_registration_guard ON public.users AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'staff' AND status = 'pending');

CREATE OR REPLACE FUNCTION public.app_can_work_specification(p_event uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS(SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status = 'active'
    AND (u.role <> 'foreman' OR EXISTS(SELECT 1 FROM public.events e WHERE e.id = p_event AND e.site_manager_id = u.id)));
$$;
REVOKE ALL ON FUNCTION public.app_can_work_specification(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_can_work_specification(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.account_guard_event_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE permitted text[] := ARRAY['updated_at']; changed text[];
BEGIN
  IF (auth.uid() IS NULL AND auth.role() IS NULL) OR auth.role() = 'service_role' OR public.app_can_access('events',2) THEN RETURN NEW; END IF;
  IF public.app_can_access('budgets',2) THEN
    permitted := permitted || ARRAY['discount_enabled','discount_percent','discount2_enabled','discount2_percent','budget_days','budget_totals_mode','budget_note','sticky_notes','progress_budget_done','progress_equipment_reserved','budget','specification'];
  END IF;
  IF public.app_can_access('specifications',2) AND public.app_can_work_specification(OLD.id) THEN
    permitted := permitted || ARRAY['equipment_shipped','equipment_shipped_at','equipment_returned','equipment_returned_at','specification_confirmed','specification_confirmed_at','specification_confirmed_by'];
  END IF;
  SELECT array_agg(n.key) INTO changed FROM jsonb_each(to_jsonb(NEW)) n WHERE n.value IS DISTINCT FROM to_jsonb(OLD) -> n.key;
  IF EXISTS(SELECT 1 FROM unnest(changed) key WHERE NOT (key = ANY(permitted))) THEN
    RAISE EXCEPTION 'Нет прав для изменения этих данных мероприятия' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.account_guard_event_update() FROM PUBLIC;
DROP TRIGGER IF EXISTS account_guard_event_update ON public.events;
CREATE TRIGGER account_guard_event_update BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.account_guard_event_update();

-- A restrictive policy prevents legacy permissive policies from bypassing configured access.
DO $$
DECLARE item record; target_table regclass; read_check text; write_check text; delete_check text; module text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('events','events','events,calendar,budgets,specifications,payments'),
  ('equipment_items','equipment','equipment,budgets,specifications'),
  ('equipment_categories','equipment','equipment,budgets,specifications'),
  ('equipment_types','equipment','equipment,budgets,specifications'),
  ('equipment_subtypes','equipment','equipment,budgets,specifications'),
  ('equipment_modifications','equipment','equipment,budgets,specifications'),
  ('modification_components','equipment','equipment,budgets,specifications'),
  ('equipment_compositions','equipment','equipment,budgets,specifications'),
  ('clients','contacts','contacts,events,calendar,budgets'),
  ('venues','contacts','contacts,events,calendar,budgets'),
  ('event_types','contacts','contacts,events,calendar'),
  ('work_items','contacts','contacts,budgets,specifications'),
  ('categories','budgets','budgets,specifications,equipment'),
  ('locations','budgets','budgets,specifications,events'),
  ('budget_items','budgets','budgets,specifications'),
  ('budget_item_personnel','budgets','budgets,staff,payments'),
  ('templates','templates','templates,budgets'),
  ('template_items','templates','templates,budgets'),
  ('personnel','staff','staff,payments,personnel-report,budgets'),
  ('payments','payments','payments,personnel-report'),
  ('warehouse_specification_budget_items','specifications','specifications'),
  ('warehouse_specification_cables','specifications','specifications'),
  ('warehouse_specification_connectors','specifications','specifications'),
  ('warehouse_specification_other','specifications','specifications')
 ) AS t(table_name,write_module,read_modules) LOOP
  target_table := to_regclass('public.' || item.table_name);
  IF target_table IS NULL THEN CONTINUE; END IF;
  read_check := 'false';
  FOREACH module IN ARRAY string_to_array(item.read_modules,',') LOOP
    read_check := read_check || format(' OR public.app_can_access(%L,1)',module);
  END LOOP;
  write_check := format('public.app_can_access(%L,2)',item.write_module);
  delete_check := format('public.app_can_access(%L,3)',item.write_module);
  IF item.write_module = 'specifications' THEN
    write_check := write_check || ' AND public.app_can_work_specification(event_id)';
    delete_check := delete_check || ' AND public.app_can_work_specification(event_id)';
  END IF;
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target_table);
  EXECUTE format('DROP POLICY IF EXISTS account_view ON %s', target_table);
  EXECUTE format('DROP POLICY IF EXISTS account_view_guard ON %s', target_table);
  EXECUTE format('CREATE POLICY account_view ON %s FOR SELECT TO authenticated USING (%s)',target_table,read_check);
  EXECUTE format('CREATE POLICY account_view_guard ON %s AS RESTRICTIVE FOR SELECT TO authenticated USING (%s)',target_table,read_check);
  EXECUTE format('DROP POLICY IF EXISTS account_insert ON %s',target_table);
  EXECUTE format('DROP POLICY IF EXISTS account_insert_guard ON %s',target_table);
  EXECUTE format('CREATE POLICY account_insert ON %s FOR INSERT TO authenticated WITH CHECK (%s)',target_table,write_check);
  EXECUTE format('CREATE POLICY account_insert_guard ON %s AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (%s)',target_table,write_check);
  IF item.table_name = 'events' THEN write_check := '(public.app_can_access(''events'',2) OR public.app_can_access(''budgets'',2) OR public.app_can_access(''specifications'',2))'; END IF;
  EXECUTE format('DROP POLICY IF EXISTS account_update ON %s',target_table);
  EXECUTE format('DROP POLICY IF EXISTS account_update_guard ON %s',target_table);
  EXECUTE format('CREATE POLICY account_update ON %s FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',target_table,write_check,write_check);
  EXECUTE format('CREATE POLICY account_update_guard ON %s AS RESTRICTIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',target_table,write_check,write_check);
  EXECUTE format('DROP POLICY IF EXISTS account_delete ON %s',target_table);
  EXECUTE format('DROP POLICY IF EXISTS account_delete_guard ON %s',target_table);
  EXECUTE format('CREATE POLICY account_delete ON %s FOR DELETE TO authenticated USING (%s)',target_table,delete_check);
  EXECUTE format('CREATE POLICY account_delete_guard ON %s AS RESTRICTIVE FOR DELETE TO authenticated USING (%s)',target_table,delete_check);
 END LOOP;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
