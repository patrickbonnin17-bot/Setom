create table if not exists public.work_order_costs (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  intervention_id uuid null references public.interventions(id) on delete set null,
  cost_date date not null default current_date,
  category text not null check (category in ('camion','carburant','materiel','autre')),
  description text not null,
  amount numeric not null default 0 check (amount >= 0),
  quantity numeric null check (quantity is null or quantity >= 0),
  unit text null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists work_order_costs_work_order_date_idx
  on public.work_order_costs(work_order_id, cost_date);

alter table public.work_order_costs enable row level security;

drop policy if exists "authenticated users can read work order costs" on public.work_order_costs;
drop policy if exists "authenticated users can insert work order costs" on public.work_order_costs;
drop policy if exists "authenticated users can update work order costs" on public.work_order_costs;

create policy "authenticated users can read work order costs"
  on public.work_order_costs for select to authenticated using (true);

create policy "authenticated users can insert work order costs"
  on public.work_order_costs for insert to authenticated with check (true);

create policy "authenticated users can update work order costs"
  on public.work_order_costs for update to authenticated using (true) with check (true);
