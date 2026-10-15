alter table public.materials
  add column if not exists density_t_m3 numeric,
  add column if not exists default_thickness_cm numeric,
  add column if not exists purchase_price_per_t numeric;

create table if not exists public.truck_daily_loads (
  id uuid primary key default gen_random_uuid(),
  load_date date not null,
  material_id uuid not null references public.materials(id) on delete restrict,
  loaded_quantity numeric not null default 0 check (loaded_quantity >= 0),
  unit text not null default 't',
  notes text,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (load_date, material_id)
);

create table if not exists public.truck_material_consumptions (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  intervention_id uuid references public.interventions(id) on delete set null,
  material_id uuid not null references public.materials(id) on delete restrict,
  consumption_date date not null default current_date,
  quantity numeric not null default 0 check (quantity >= 0),
  unit text not null default 't',
  estimated boolean not null default true,
  source text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (work_order_id, material_id, consumption_date)
);

alter table public.truck_daily_loads enable row level security;
alter table public.truck_material_consumptions enable row level security;

drop policy if exists truck_loads_select on public.truck_daily_loads;
create policy truck_loads_select on public.truck_daily_loads for select using (setom_current_role() = any(array['admin','bureau','equipe_terrain']));
drop policy if exists truck_loads_manage on public.truck_daily_loads;
create policy truck_loads_manage on public.truck_daily_loads for all using (setom_is_office()) with check (setom_is_office());

drop policy if exists truck_consumptions_select on public.truck_material_consumptions;
create policy truck_consumptions_select on public.truck_material_consumptions for select using (setom_current_role() = any(array['admin','bureau','equipe_terrain','eau_de_toulouse']) and setom_can_access_work_order(work_order_id));
drop policy if exists truck_consumptions_insert on public.truck_material_consumptions;
create policy truck_consumptions_insert on public.truck_material_consumptions for insert with check (setom_is_office() or (setom_current_role() = 'equipe_terrain' and setom_can_access_work_order(work_order_id)));
drop policy if exists truck_consumptions_update on public.truck_material_consumptions;
create policy truck_consumptions_update on public.truck_material_consumptions for update using (setom_is_office() or (setom_current_role() = 'equipe_terrain' and setom_can_access_work_order(work_order_id))) with check (setom_is_office() or (setom_current_role() = 'equipe_terrain' and setom_can_access_work_order(work_order_id)));
drop policy if exists truck_consumptions_delete on public.truck_material_consumptions;
create policy truck_consumptions_delete on public.truck_material_consumptions for delete using (setom_is_office());

create index if not exists truck_daily_loads_date_idx on public.truck_daily_loads(load_date);
create index if not exists truck_daily_loads_material_idx on public.truck_daily_loads(material_id);
create index if not exists truck_consumptions_date_idx on public.truck_material_consumptions(consumption_date);
create index if not exists truck_consumptions_material_idx on public.truck_material_consumptions(material_id);
