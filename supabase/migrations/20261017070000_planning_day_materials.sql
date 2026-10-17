create table if not exists public.planning_day_materials (
  planning_date date primary key,
  material_name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planning_day_materials enable row level security;

create policy "planning_day_materials_select_authenticated"
on public.planning_day_materials for select
to authenticated
using (true);

create policy "planning_day_materials_insert_authenticated"
on public.planning_day_materials for insert
to authenticated
with check (true);

create policy "planning_day_materials_update_authenticated"
on public.planning_day_materials for update
to authenticated
using (true)
with check (true);

create policy "planning_day_materials_delete_authenticated"
on public.planning_day_materials for delete
to authenticated
using (true);
