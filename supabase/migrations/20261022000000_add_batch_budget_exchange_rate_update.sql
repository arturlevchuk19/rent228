create or replace function public.update_budget_items_exchange_rate(
  p_event_id uuid,
  p_exchange_rate numeric
)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.budget_items
  set exchange_rate = p_exchange_rate,
      updated_at = now()
  where event_id = p_event_id
    and exchange_rate is distinct from p_exchange_rate;
$$;

revoke all on function public.update_budget_items_exchange_rate(uuid, numeric) from public;
grant execute on function public.update_budget_items_exchange_rate(uuid, numeric) to authenticated;