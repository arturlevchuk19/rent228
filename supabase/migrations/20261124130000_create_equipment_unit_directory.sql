CREATE TABLE public.equipment_units (
  name text PRIMARY KEY CHECK (name <> '' AND name = btrim(name))
);

INSERT INTO public.equipment_units (name)
SELECT unnest(ARRAY['шт.', 'м.', 'комп.', 'ед.', 'чел.', 'л.', 'кг', 'услуга', 'час', 'смена'])
UNION
SELECT DISTINCT unit FROM public.equipment_items;

CREATE UNIQUE INDEX equipment_units_name_lower_idx ON public.equipment_units (lower(name));

ALTER TABLE public.equipment_units ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.equipment_units FROM anon, authenticated;
GRANT SELECT, INSERT ON public.equipment_units TO authenticated;

CREATE POLICY equipment_units_read ON public.equipment_units
  FOR SELECT TO authenticated
  USING (
    public.app_can_access('contacts', 1)
    OR public.app_can_access('equipment', 1)
    OR public.app_can_access('budgets', 1)
  );

CREATE POLICY equipment_units_create ON public.equipment_units
  FOR INSERT TO authenticated
  WITH CHECK (public.app_can_access('contacts', 2));

ALTER TABLE public.equipment_items
  DROP CONSTRAINT equipment_items_unit_check,
  ADD CONSTRAINT equipment_items_unit_fkey
    FOREIGN KEY (unit) REFERENCES public.equipment_units (name);
