-- Local integration fixture. Run only in a new, disposable PostgreSQL database.
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;
CREATE FUNCTION public.app_can_access(module text, level integer) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('test.'||module,true),''),'3')::int >= level $$;
CREATE FUNCTION public.app_can_work_specification(event_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE TABLE public.events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text DEFAULT 'Запрос', discount_enabled boolean DEFAULT false, discount_percent numeric DEFAULT 0, discount2_enabled boolean DEFAULT false, discount2_percent numeric DEFAULT 0, budget_days integer DEFAULT 1, budget_totals_mode text DEFAULT 'combined_only', budget_note text DEFAULT '', sticky_notes text DEFAULT '', equipment_shipped boolean DEFAULT false, equipment_shipped_at timestamptz, equipment_returned boolean DEFAULT false, equipment_returned_at timestamptz, specification_confirmed boolean DEFAULT false, specification_confirmed_at timestamptz, specification_confirmed_by uuid, progress_budget_done boolean DEFAULT false, progress_equipment_reserved boolean DEFAULT false, progress_project_completed boolean DEFAULT false);
CREATE TABLE public.budget_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,parent_budget_item_id uuid REFERENCES public.budget_items(id) ON DELETE CASCADE,item_type text DEFAULT 'equipment', category_id uuid, location_id uuid, quantity numeric DEFAULT 1, exchange_rate numeric DEFAULT 1);
ALTER TABLE public.budget_items ADD COLUMN equipment_id uuid, ADD COLUMN work_item_id uuid, ADD COLUMN modification_id uuid,
 ADD COLUMN price numeric DEFAULT 0, ADD COLUMN total numeric DEFAULT 0, ADD COLUMN notes text DEFAULT '', ADD COLUMN multi_day_rate_override numeric,
 ADD COLUMN sort_order integer DEFAULT 0, ADD COLUMN picked boolean DEFAULT false, ADD COLUMN return_picked boolean DEFAULT false,
 ADD COLUMN is_extra boolean DEFAULT false, ADD COLUMN name text, ADD COLUMN sku text, ADD COLUMN unit text, ADD COLUMN marker_color text,
 ADD COLUMN created_at timestamptz DEFAULT now();
CREATE TABLE public.warehouse_specification_budget_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE, parent_budget_item_id uuid REFERENCES public.warehouse_specification_budget_items(id) ON DELETE CASCADE, item_type text DEFAULT 'equipment', equipment_id uuid, category_id uuid, location_id uuid, name text, sku text, quantity numeric DEFAULT 1, price numeric DEFAULT 0, total numeric DEFAULT 0, exchange_rate numeric DEFAULT 1, notes text, picked boolean DEFAULT false, return_picked boolean DEFAULT false, is_extra boolean DEFAULT false, sort_order integer DEFAULT 0, updated_at timestamptz DEFAULT now());
CREATE TABLE public.warehouse_specification_cables(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE, quantity numeric DEFAULT 1);
CREATE TABLE public.warehouse_specification_connectors(LIKE public.warehouse_specification_cables INCLUDING ALL);
ALTER TABLE public.warehouse_specification_connectors ADD FOREIGN KEY(event_id) REFERENCES public.events(id) ON DELETE CASCADE;
CREATE TABLE public.warehouse_specification_other(LIKE public.warehouse_specification_cables INCLUDING ALL);
ALTER TABLE public.warehouse_specification_other ADD FOREIGN KEY(event_id) REFERENCES public.events(id) ON DELETE CASCADE;
CREATE TABLE public.categories(name text, description text, is_template boolean DEFAULT false, sort_order integer DEFAULT 0, id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid REFERENCES public.events(id) ON DELETE CASCADE);
CREATE TABLE public.locations(name text,color text,sort_order integer DEFAULT 0,id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE);
INSERT INTO public.events(id,status,budget_note) VALUES('11111111-1111-4111-8111-111111111111','Подтверждено','Legacy note'),('22222222-2222-4222-8222-222222222222','Запрос','');
INSERT INTO public.budget_items(id,event_id) VALUES('aaaaaaaa-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111');
INSERT INTO public.budget_items(event_id,parent_budget_item_id) VALUES('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111');
INSERT INTO public.warehouse_specification_budget_items(event_id,name) VALUES('11111111-1111-4111-8111-111111111111','Existing item');
INSERT INTO public.warehouse_specification_cables(event_id) VALUES('11111111-1111-4111-8111-111111111111');
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
