alter table public.events add column if not exists site_manager_id uuid references public.users(id) on delete set null;

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('superuser', 'admin', 'foreman', 'clerk', 'staff', 'warehouse'));

create index if not exists events_site_manager_id_idx on public.events(site_manager_id);
