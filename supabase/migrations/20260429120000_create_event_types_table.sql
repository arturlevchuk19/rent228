create table if not exists public.event_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.event_types enable row level security;

create policy "Users can view their event types"
  on public.event_types for select
  using (auth.uid() = user_id);

create policy "Users can insert their event types"
  on public.event_types for insert
  with check (auth.uid() = user_id);

create policy "Users can update their event types"
  on public.event_types for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their event types"
  on public.event_types for delete
  using (auth.uid() = user_id);

create or replace function public.set_event_types_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_event_types_updated_at on public.event_types;
create trigger trg_event_types_updated_at
before update on public.event_types
for each row execute function public.set_event_types_updated_at();
