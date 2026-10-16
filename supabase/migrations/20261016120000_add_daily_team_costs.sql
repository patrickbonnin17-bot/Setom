create table if not exists public.daily_team_costs (
  id uuid primary key default gen_random_uuid(),
  cost_date date not null,
  team_id uuid null,
  personnel_amount numeric not null default 0 check (personnel_amount >= 0),
  vehicles_amount numeric not null default 0 check (vehicles_amount >= 0),
  materials_amount numeric not null default 0 check (materials_amount >= 0),
  equipment_amount numeric not null default 0 check (equipment_amount >= 0),
  fuel_amount numeric not null default 0 check (fuel_amount >= 0),
  other_amount numeric not null default 0 check (other_amount >= 0),
  hours numeric not null default 0 check (hours >= 0),
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cost_date, team_id)
);

create index if not exists idx_daily_team_costs_date on public.daily_team_costs(cost_date);

alter table public.daily_team_costs enable row level security;

create policy "daily_team_costs_select_authenticated"
  on public.daily_team_costs for select
  to authenticated
  using (true);

create policy "daily_team_costs_insert_authenticated"
  on public.daily_team_costs for insert
  to authenticated
  with check (true);

create policy "daily_team_costs_update_authenticated"
  on public.daily_team_costs for update
  to authenticated
  using (true)
  with check (true);
