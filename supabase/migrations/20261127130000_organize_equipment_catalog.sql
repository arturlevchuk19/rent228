-- Keep the old global category records available to any historical documents.
ALTER TABLE public.categories
  ADD COLUMN hidden_from_equipment_catalog boolean NOT NULL DEFAULT false;

UPDATE public.categories
SET hidden_from_equipment_catalog = true
WHERE event_id IS NULL AND name IN ('Кабель', 'Коннектор');

INSERT INTO public.categories (name, description, sort_order)
SELECT new_category.name, '', coalesce((
  SELECT c.sort_order FROM public.categories c
  WHERE c.event_id IS NULL AND c.name = new_category.place_after
  ORDER BY c.sort_order LIMIT 1
), (SELECT coalesce(max(sort_order), 0) + 1 FROM public.categories WHERE event_id IS NULL))
FROM (VALUES ('Коммутация', 'Кабель'), ('Мебель и оформление', 'Прочее')) AS new_category(name, place_after)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.event_id IS NULL AND c.name = new_category.name
);

-- Map existing equipment and directory entries, including options that have yet to be used.
CREATE TEMP TABLE equipment_catalog_moves AS
WITH existing AS (
  SELECT category, type, subtype FROM public.equipment_items
  UNION
  SELECT category, type, subtype FROM public.equipment_classifications
), mapped AS (
  SELECT category, type, subtype,
    CASE
      WHEN category IN ('Кабель', 'Коннектор') THEN 'Коммутация'
      WHEN category = 'Прочее' AND type IN ('Стол', 'Стул', 'Ширма') THEN 'Мебель и оформление'
      WHEN category = 'Прочее' AND type = 'Такелаж' THEN 'Сцена'
      ELSE category
    END AS new_category,
    CASE
      WHEN category = 'Кабель' AND type = 'Коммутация' THEN 'Комплекты'
      WHEN category = 'Кабель' AND type NOT ILIKE '%виртуальн%' THEN 'Кабели'
      WHEN category = 'Коннектор' AND subtype = 'Брейк' THEN 'Переходники'
      WHEN category = 'Коннектор' AND (subtype = 'Карабулька' OR subtype ILIKE 'Сплиттер%') THEN 'Разветвители'
      WHEN category = 'Коннектор' AND type NOT ILIKE '%виртуальн%' THEN 'Разъёмы'
      WHEN category = 'Сцена' AND type IN ('Ферма серебрянная', 'Ферма серебряная', 'Ферма чёрная') THEN 'Фермы'
      WHEN category = 'Сцена' AND type = 'Подиум' THEN 'Подиумы'
      ELSE type
    END AS new_type,
    CASE
      WHEN category = 'Кабель' AND type <> 'Коммутация' AND type NOT ILIKE '%виртуальн%'
        THEN concat_ws(' / ', nullif(type, ''), nullif(subtype, ''))
      WHEN category = 'Коннектор' AND type NOT ILIKE '%виртуальн%'
        THEN concat_ws(' / ', nullif(type, ''), nullif(subtype, ''))
      WHEN category = 'Сцена' AND type IN ('Ферма серебрянная', 'Ферма серебряная', 'Ферма чёрная')
        THEN concat_ws(' / ', CASE WHEN type = 'Ферма чёрная' THEN 'Чёрная' ELSE 'Серебристая' END, nullif(subtype, ''))
      ELSE subtype
    END AS new_subtype
  FROM existing
)
SELECT * FROM mapped
WHERE (category, type, subtype) IS DISTINCT FROM (new_category, new_type, new_subtype);

UPDATE public.equipment_items AS item
SET category = move.new_category, type = move.new_type, subtype = move.new_subtype
FROM equipment_catalog_moves AS move
WHERE (item.category, item.type, item.subtype) = (move.category, move.type, move.subtype);

-- These records have distinct uses that were not encoded in their old classification.
UPDATE public.equipment_items AS item
SET category = move.category, type = move.type, subtype = move.subtype
FROM (VALUES
  ('OTH_SWITCH_SNR', 'Коммутация', 'Сетевое оборудование', 'Коммутаторы'),
  ('OTH_SWITCH_TP-LINK', 'Коммутация', 'Сетевое оборудование', 'Коммутаторы'),
  ('OTH_ROUTER_KEENETIC_HOPPER', 'Коммутация', 'Сетевое оборудование', 'Маршрутизаторы'),
  ('OTH_OTH_HAMMER', 'Инструмент', 'Ручной инструмент', 'Кувалды'),
  ('OTH_OTH_FSTNES', 'Сцена', 'Крепление', 'Стаканы для стоек')
) AS move(sku, category, type, subtype)
WHERE item.category = 'Прочее' AND item.sku = move.sku;

UPDATE public.equipment_items
SET type = 'Разветвители', subtype = 'Силовой / Тройник'
WHERE category = 'Коммутация' AND sku = 'CON_PWR_BREAK_32А_Х3';

DELETE FROM public.equipment_classifications AS entry
USING equipment_catalog_moves AS move
WHERE (entry.category, entry.type, entry.subtype) = (move.category, move.type, move.subtype);

INSERT INTO public.equipment_classifications (category, type, subtype)
SELECT new_category, new_type, '' FROM equipment_catalog_moves WHERE btrim(new_type) <> ''
UNION
SELECT new_category, new_type, new_subtype FROM equipment_catalog_moves
WHERE btrim(subtype) <> '' AND btrim(new_type) <> '' AND btrim(new_subtype) <> ''
UNION
SELECT category, type, '' FROM public.equipment_items WHERE btrim(category) <> '' AND btrim(type) <> ''
UNION
SELECT category, type, subtype FROM public.equipment_items
WHERE btrim(category) <> '' AND btrim(type) <> '' AND btrim(subtype) <> ''
ON CONFLICT DO NOTHING;

DROP TABLE equipment_catalog_moves;
