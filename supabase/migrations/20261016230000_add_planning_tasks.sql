create table if not exists public.planning_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  task_date date not null,
  start_time time,
  end_time time,
  team_id uuid references public.teams(id) on delete set null,
  sector_id uuid references public.sectors(id) on delete set null,
  address text,
  priority text not null default 'Normale' check (priority in ('Basse','Normale','Haute','Urgente')),
  status text not null default 'À faire' check (status in ('À faire','En cours','Terminée','Annulée')),
  color text,
  planned_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planning_tasks_date_idx on public.planning_tasks(task_date);
create index if not exists planning_tasks_team_date_idx on public.planning_tasks(team_id, task_date);

alter table public.planning_tasks enable row level security;

drop policy if exists planning_tasks_select on public.planning_tasks;
drop policy if exists planning_tasks_insert on public.planning_tasks;
drop policy if exists planning_tasks_update on public.planning_tasks;
drop policy if exists planning_tasks_delete on public.planning_tasks;

create policy planning_tasks_select on public.planning_tasks
  for select to authenticated using (true);

create policy planning_tasks_insert on public.planning_tasks
  for insert to authenticated
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.active = true and p.role in ('admin','bureau')));

create policy planning_tasks_update on public.planning_tasks
  for update to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.active = true and p.role in ('admin','bureau')))
  with check (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.active = true and p.role in ('admin','bureau')));

create policy planning_tasks_delete on public.planning_tasks
  for delete to authenticated
  using (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.active = true and p.role in ('admin','bureau')));

create or replace function public.set_planning_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planning_tasks_updated_at on public.planning_tasks;
create trigger planning_tasks_updated_at
before update on public.planning_tasks
for each row execute function public.set_planning_tasks_updated_at();
