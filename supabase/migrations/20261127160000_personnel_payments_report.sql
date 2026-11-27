CREATE FUNCTION public.personnel_payments_report(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE next_month date;
BEGIN
  IF NOT coalesce(public.app_can_access('personnel-report', 1), false) THEN
    RAISE EXCEPTION 'Нет доступа к отчёту по выплатам' USING ERRCODE = '42501';
  END IF;
  IF p_month IS NULL OR extract(day FROM p_month) <> 1 THEN
    RAISE EXCEPTION 'Выберите месяц' USING ERRCODE = '22023';
  END IF;
  next_month := (p_month + interval '1 month')::date;
  RETURN (
    WITH selected_events AS (
      SELECT e.id, coalesce(nullif(e.name, ''), e.event_type) AS name, e.event_date,
        public.accounting_event_fields(e.project_details) AS details,
        coalesce((
          SELECT jsonb_object_agg(key, value) FROM jsonb_each(to_jsonb(e))
          WHERE key IN ('budget_payment_mode', 'budget_exchange_rate', 'budget_days', 'budget_totals_mode',
            'discount_enabled', 'discount_percent', 'discount2_enabled', 'discount2_percent',
            'budget_dynamic_coefficients', 'budget_coefficient_groups')
        ), '{}'::jsonb) AS settings
      FROM public.events e
      WHERE e.event_date >= p_month::text AND e.event_date < next_month::text
        AND e.event_date ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
        AND e.status IS DISTINCT FROM 'Отменено'
    )
    SELECT jsonb_build_object(
      'events', coalesce((
        SELECT jsonb_agg(to_jsonb(e) || jsonb_build_object(
          'budgets', coalesce((
            SELECT jsonb_agg(jsonb_build_object('id', b.id, 'is_primary', b.is_primary, 'settings', b.settings - ARRAY['budget_note','sticky_notes'])
              ORDER BY b.is_primary DESC, b.sort_order, b.created_at, b.id)
            FROM public.event_budgets b WHERE b.event_id = e.id
          ), '[]'::jsonb),
          'items', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
              'id', i.id, 'budget_id', i.budget_id, 'price', i.price, 'quantity', i.quantity,
              'item_type', i.item_type, 'name', i.name, 'work_item_id', i.work_item_id,
              'work_item', jsonb_build_object('name', w.name),
              'equipment', jsonb_build_object('category', eq.category),
              'multi_day_rate_override', i.multi_day_rate_override,
              'is_extra', coalesce(i.is_extra, false) OR coalesce(c.description = '__extra_service__', false)
            ) ORDER BY i.sort_order, i.id)
            FROM public.budget_items i
            LEFT JOIN public.work_items w ON w.id = i.work_item_id
            LEFT JOIN public.equipment_items eq ON eq.id = i.equipment_id
            LEFT JOIN public.categories c ON c.id = i.category_id
            WHERE i.event_id = e.id AND i.parent_budget_item_id IS NULL
          ), '[]'::jsonb)
        ) ORDER BY e.event_date, e.id) FROM selected_events e
      ), '[]'::jsonb),
      'claims', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', a.id, 'personnel_id', a.personnel_id, 'employee_name', a.employee_name,
          'event_id', a.event_id, 'state', a.state,
          'date', (coalesce(a.approved_at, a.submitted_at, a.created_at) AT TIME ZONE 'Europe/Minsk')::date,
          'lines', coalesce((
            SELECT jsonb_agg(line - ARRAY['receipt_path', 'description'] ORDER BY ord)
            FROM jsonb_array_elements(a.lines) WITH ORDINALITY l(line, ord)
          ), '[]'::jsonb)
        ) ORDER BY a.id)
        FROM public.employee_claims a
        WHERE a.state IN ('approved', 'paid') AND (
          a.event_id IN (SELECT id FROM selected_events)
          OR (a.event_id IS NULL AND (
            (coalesce(a.approved_at, a.submitted_at, a.created_at) AT TIME ZONE 'Europe/Minsk')::date >= p_month
            AND (coalesce(a.approved_at, a.submitted_at, a.created_at) AT TIME ZONE 'Europe/Minsk')::date < next_month
            OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(a.lines) AS l(line)
              WHERE line->>'kind' = 'warehouse'
                AND left(line->>'starts_at', 10) >= (p_month - 1)::text
                AND left(line->>'starts_at', 10) <= next_month::text
            )
          ))
        )
      ), '[]'::jsonb)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.personnel_payments_report(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.personnel_payments_report(date) TO authenticated;
NOTIFY pgrst, 'reload schema';
