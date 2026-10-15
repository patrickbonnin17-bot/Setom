create or replace function public.sync_os_after_intervention_or_constat()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_work_order_id uuid;
  v_user uuid := auth.uid();
  v_current_status text;
begin
  if tg_table_name = 'interventions' then
    v_work_order_id := new.work_order_id;

    if new.status = 'Travaux effectués' and old.status is distinct from new.status then
      if not exists (
        select 1
        from public.attachments a
        where a.work_order_id = v_work_order_id
          and a.category = 'travaux_realises'
          and coalesce(a.mime_type, '') like 'image/%'
      ) then
        raise exception 'Transmission impossible : ajoutez au moins une photo des travaux réalisés.';
      end if;

      if exists (
        select 1
        from public.constats c
        where c.work_order_id = v_work_order_id
          and c.status in ('Validé', 'Validé avec réserve', 'Payé', 'Archivé')
      ) then
        return new;
      end if;

      select wo.status into v_current_status
      from public.work_orders wo
      where wo.id = v_work_order_id
      for update;

      if v_current_status is null then
        raise exception 'OS introuvable pour cette intervention';
      end if;

      if v_current_status = 'Planifié' then
        update public.work_orders
           set status = 'Travaux en cours', updated_at = now(), updated_by = v_user
         where id = v_work_order_id;
        v_current_status := 'Travaux en cours';
      end if;

      if v_current_status = 'Travaux en cours' then
        update public.work_orders
           set status = 'Travaux réalisés', updated_at = now(), updated_by = v_user
         where id = v_work_order_id;
        v_current_status := 'Travaux réalisés';
      end if;

      if v_current_status = 'Travaux réalisés' then
        update public.work_orders
           set status = 'Constat à vérifier', updated_at = now(), updated_by = v_user
         where id = v_work_order_id;
        v_current_status := 'Constat à vérifier';
      end if;

      if v_current_status <> 'Constat à vérifier' then
        raise exception 'Transmission impossible depuis le statut OS « % »', v_current_status;
      end if;

      perform public.generate_constat_for_work_order(v_work_order_id, v_user);
    end if;

  elsif tg_table_name = 'constats' then
    v_work_order_id := new.work_order_id;

    if new.status in ('Validé', 'Validé avec réserve')
       and old.status is distinct from new.status then
      update public.work_orders
         set status = 'Constat validé', updated_at = now(), updated_by = v_user
       where id = v_work_order_id
         and status = 'Constat à vérifier';

      update public.work_orders
         set status = 'Travaux effectués', updated_at = now(), updated_by = v_user
       where id = v_work_order_id
         and status = 'Constat validé';
    end if;
  end if;

  return new;
end;
$function$;
