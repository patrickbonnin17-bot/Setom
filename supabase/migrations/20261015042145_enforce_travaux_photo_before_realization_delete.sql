create or replace function public.guard_work_realization_changes_without_photo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1
    from public.attachments a
    where a.work_order_id = coalesce(old.work_order_id, (
      select i.work_order_id
      from public.interventions i
      where i.id = old.intervention_id
    ))
      and a.category = 'travaux_realises'
      and coalesce(a.mime_type, '') like 'image/%'
  ) then
    raise exception 'Impossible de modifier ou supprimer les travaux réalisés sans photo des travaux réalisés.';
  end if;
  return old;
end;
$function$;

revoke all on function public.guard_work_realization_changes_without_photo() from public, anon, authenticated;

drop trigger if exists trg_guard_work_realization_delete_photo on public.work_realizations;
create trigger trg_guard_work_realization_delete_photo
before delete on public.work_realizations
for each row
execute function public.guard_work_realization_changes_without_photo();

create or replace function public.guard_work_order_travaux_realises_photo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status = 'Travaux réalisés' and old.status is distinct from new.status then
    if not exists (
      select 1
      from public.attachments a
      where a.work_order_id = new.id
        and a.category = 'travaux_realises'
        and coalesce(a.mime_type, '') like 'image/%'
    ) then
      raise exception 'Impossible de passer à Travaux réalisés sans photo des travaux réalisés.';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_work_order_travaux_realises_photo() from public, anon, authenticated;

drop trigger if exists trg_guard_work_order_travaux_realises_photo on public.work_orders;
create trigger trg_guard_work_order_travaux_realises_photo
before update on public.work_orders
for each row
execute function public.guard_work_order_travaux_realises_photo();
