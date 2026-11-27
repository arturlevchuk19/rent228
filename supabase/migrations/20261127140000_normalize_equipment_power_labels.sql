CREATE FUNCTION public.canonical_equipment_type(value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT CASE lower(btrim(value))
    WHEN 'силовой распределитель' THEN 'Распределитель питания'
    WHEN 'распределитель питания' THEN 'Распределитель питания'
    ELSE value
  END;
$$;

CREATE FUNCTION public.canonical_equipment_subtype(value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT regexp_replace(btrim(value), '([0-9]+)[[:space:]]*[AaАа](?=$|[^[:alnum:]])', '\1А', 'g');
$$;

UPDATE public.equipment_items
SET type = public.canonical_equipment_type(type),
    subtype = public.canonical_equipment_subtype(subtype)
WHERE (type, subtype) IS DISTINCT FROM (public.canonical_equipment_type(type), public.canonical_equipment_subtype(subtype));

WITH replaced AS (
  DELETE FROM public.equipment_classifications
  WHERE (type, subtype) IS DISTINCT FROM (public.canonical_equipment_type(type), public.canonical_equipment_subtype(subtype))
  RETURNING category, type, subtype
)
INSERT INTO public.equipment_classifications (category, type, subtype)
SELECT category, public.canonical_equipment_type(type), public.canonical_equipment_subtype(subtype)
FROM replaced
ON CONFLICT DO NOTHING;

CREATE FUNCTION public.normalize_equipment_classification()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  NEW.type := public.canonical_equipment_type(NEW.type);
  NEW.subtype := public.canonical_equipment_subtype(NEW.subtype);
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_equipment_item_classification
BEFORE INSERT OR UPDATE OF type, subtype ON public.equipment_items
FOR EACH ROW EXECUTE FUNCTION public.normalize_equipment_classification();

CREATE TRIGGER normalize_equipment_directory_classification
BEFORE INSERT OR UPDATE OF type, subtype ON public.equipment_classifications
FOR EACH ROW EXECUTE FUNCTION public.normalize_equipment_classification();

-- Preserve the actual brand/model spelling. Normalize only the searchable representation.
ALTER TABLE public.equipment_items
  ADD COLUMN search_name text GENERATED ALWAYS AS (translate(public.canonical_equipment_subtype(name), 'AaАа', 'аааа')) STORED;
