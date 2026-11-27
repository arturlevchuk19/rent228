-- Preserve global category IDs and leave event-specific budget sections alone.
WITH equipment_category_aliases(old_name, new_name) AS (VALUES
  ('звуковое оборудование', 'Звук'),
  ('световое оборудование', 'Свет'),
  ('видеооборудование', 'Видео'),
  ('видео оборудование', 'Видео'),
  ('сценическое оборудование', 'Сцена')
), renamed_categories AS (
  UPDATE public.categories AS category
  SET name = alias.new_name
  FROM equipment_category_aliases AS alias
  WHERE category.event_id IS NULL
    AND lower(regexp_replace(category.name, '^\s+|\s+$', '', 'g')) = alias.old_name
)
UPDATE public.equipment_items AS item
SET category = alias.new_name
FROM equipment_category_aliases AS alias
WHERE lower(regexp_replace(item.category, '^\s+|\s+$', '', 'g')) = alias.old_name;

-- Register category names currently used by equipment but missing from the directory.
INSERT INTO public.categories (name, description, sort_order)
SELECT names.category, '', base.sort_order + row_number() OVER (ORDER BY names.category)
FROM (
  SELECT DISTINCT category FROM public.equipment_items WHERE btrim(category) <> ''
  EXCEPT
  SELECT name FROM public.categories WHERE event_id IS NULL
) AS names
CROSS JOIN (
  SELECT coalesce(max(sort_order), 0) AS sort_order FROM public.categories WHERE event_id IS NULL
) AS base;

CREATE TABLE public.equipment_classifications (
  category text NOT NULL CHECK (btrim(category) <> ''),
  type text NOT NULL CHECK (btrim(type) <> ''),
  subtype text NOT NULL DEFAULT '',
  PRIMARY KEY (category, type, subtype)
);

-- An empty subtype keeps a type available before its first subtype is created.
INSERT INTO public.equipment_classifications (category, type, subtype)
SELECT category, type, '' FROM public.equipment_items
WHERE btrim(category) <> '' AND btrim(type) <> ''
UNION
SELECT category, type, subtype FROM public.equipment_items
WHERE btrim(category) <> '' AND btrim(type) <> '' AND btrim(subtype) <> '';

ALTER TABLE public.equipment_classifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.equipment_classifications TO authenticated;
CREATE POLICY equipment_classifications_read ON public.equipment_classifications
  FOR SELECT TO authenticated USING (public.app_can_access('equipment', 1));
CREATE POLICY equipment_classifications_create ON public.equipment_classifications
  FOR INSERT TO authenticated WITH CHECK (public.app_can_access('equipment', 2));
