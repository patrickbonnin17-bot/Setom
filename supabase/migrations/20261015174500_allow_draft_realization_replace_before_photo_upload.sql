create or replace function public.guard_work_realization_changes_without_photo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_work_order_id uuid;
  v_intervention_status text;
  v_work_order_status text;
begin
  v_work_order_id := coalesce(old.work_order_id, (
    select i.work_order_id from public.interventions i where i.id = old.intervention_id
  ));

  select i.status into v_intervention_status
  from public.interventions i
  where i.id = old.intervention_id;

  select wo.status into v_work_order_status
  from public.work_orders wo
  where wo.id = v_work_order_id;

  -- During preparation/transmission, the client replaces draft realization rows
  -- before uploading the new photos. The photo requirement is enforced when
  -- the intervention is actually marked Travaux effectués.
  if coalesce(v_intervention_status, '') not in ('Travaux effectués')
     and coalesce(v_work_order_status, '') not in ('Travaux réalisés','Constat à vérifier','Constat validé','Travaux effectués','Payé','Archivé') then
    return old;
  end if;

  if not exists (
    select 1
    from public.attachments a
    where a.work_order_id = v_work_order_id
      and a.category = 'travaux_realises'
      and coalesce(a.mime_type, '') like 'image/%'
  ) then
    raise exception 'Impossible de modifier ou supprimer les travaux réalisés sans photo des travaux réalisés.';
  end if;
  return old;
end;
$function$;
