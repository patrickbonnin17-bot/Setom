-- Restore authenticated access to the material tracking tables while preserving RLS.
grant select, insert, update, delete on table public.truck_material_consumptions to authenticated;
grant select, insert, update, delete on table public.truck_daily_loads to authenticated;

-- Complementary costs are an office-management feature.
grant select, insert, update on table public.work_order_costs to authenticated;

drop policy if exists "authenticated users can read work order costs" on public.work_order_costs;
drop policy if exists "authenticated users can insert work order costs" on public.work_order_costs;
drop policy if exists "authenticated users can update work order costs" on public.work_order_costs;
drop policy if exists "office can read work order costs" on public.work_order_costs;
drop policy if exists "office can insert work order costs" on public.work_order_costs;
drop policy if exists "office can update work order costs" on public.work_order_costs;

create policy "office can read work order costs"
  on public.work_order_costs for select
  to authenticated
  using (public.setom_is_office());

create policy "office can insert work order costs"
  on public.work_order_costs for insert
  to authenticated
  with check (public.setom_is_office());

create policy "office can update work order costs"
  on public.work_order_costs for update
  to authenticated
  using (public.setom_is_office())
  with check (public.setom_is_office());
