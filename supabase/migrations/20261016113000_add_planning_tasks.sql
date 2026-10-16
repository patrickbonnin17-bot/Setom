create table if not exists public.planning_tasks (
  id uuid primary key default gen_random_uuid(),
  task_date date not null,
  team_id uuid null references public.teams(id) on delete set null,
  title text not null,
  category text not null default 'autre' check (category in ('preparation','signalisation','chargement','nettoyage','entretien','approvisionnement','deplacement','administratif','autre')),
  notes text null,
  planned_order integer null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists planning_tasks_date_team_idx on public.planning_tasks(task_date, team_id, planned_order);
alter table public.planning_tasks enable row level security;
grant select, insert, update, delete on public.planning_tasks to authenticated;
drop policy if exists "authenticated can read planning tasks" on public.planning_tasks;
create policy "authenticated can read planning tasks" on public.planning_tasks for select to authenticated using (true);
drop policy if exists "office can insert planning tasks" on public.planning_tasks;
create policy "office can insert planning tasks" on public.planning_tasks for insert to authenticated with check (public.setom_is_office());
drop policy if exists "office can update planning tasks" on public.planning_tasks;
create policy "office can update planning tasks" on public.planning_tasks for update to authenticated using (public.setom_is_office()) with check (public.setom_is_office());
drop policy if exists "office can delete planning tasks" on public.planning_tasks;
create policy "office can delete planning tasks" on public.planning_tasks for delete to authenticated using (public.setom_is_office());
