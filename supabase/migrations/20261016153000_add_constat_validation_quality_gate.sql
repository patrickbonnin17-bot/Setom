create or replace function public.check_constat_before_validation(p_work_order_id uuid, p_constat_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_line_count integer;
  v_error_count integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_expected_total numeric;
  v_total numeric;
  v_bad_lines integer;
  v_intervention_status text;
  v_planned numeric;
  v_actual numeric;
begin
  select c.status into v_status
  from public.constats c
  where c.id = p_constat_id and c.work_order_id = p_work_order_id;

  if v_status is null then
    return jsonb_build_object('ok',false,'errors',jsonb_build_array('Constat introuvable pour cet OS.'),'warnings','[]'::jsonb);
  end if;

  if v_status <> 'À vérifier' then
    v_errors := v_errors || jsonb_build_array('Le constat doit être au statut « À vérifier » avant validation.');
  end if;

  select count(*) into v_line_count from public.constat_lines where constat_id = p_constat_id;

  if v_line_count = 0 then
    v_errors := v_errors || jsonb_build_array('Le constat ne contient aucune ligne de facturation.');
  end if;

  select count(*) into v_bad_lines
  from public.constat_lines cl
  where cl.constat_id = p_constat_id
    and (nullif(trim(coalesce(cl.designation,'')),'') is null
      or nullif(trim(coalesce(cl.unit,'')),'') is null
      or coalesce(cl.quantity,0) <= 0
      or cl.bpu_line_id is null
      or coalesce(cl.unit_price,0) <= 0);

  if v_bad_lines > 0 then
    v_errors := v_errors || jsonb_build_array(format('%s ligne(s) du constat sont incomplètes : désignation, unité, quantité, BPU ou prix unitaire à contrôler.', v_bad_lines));
  end if;

  select coalesce(sum(round(cl.quantity * cl.unit_price,2)),0), coalesce(max(c.total_amount),0)
    into v_expected_total, v_total
  from public.constat_lines cl
  join public.constats c on c.id = cl.constat_id
  where cl.constat_id = p_constat_id;

  if abs(coalesce(v_expected_total,0) - coalesce(v_total,0)) > 0.02 then
    v_errors := v_errors || jsonb_build_array(format('Le total du constat (%s €) ne correspond pas au total des lignes (%s €).', round(coalesce(v_total,0),2), round(coalesce(v_expected_total,0),2)));
  end if;

  select i.status into v_intervention_status
  from public.interventions i
  where i.id = (select c.intervention_id from public.constats c where c.id = p_constat_id)
  limit 1;

  if v_intervention_status is null then
    v_errors := v_errors || jsonb_build_array('Aucune intervention associée au constat.');
  elsif v_intervention_status not in ('Travaux effectués','Travaux réalisés') then
    v_warnings := v_warnings || jsonb_build_array(format('Statut de l’intervention : %s.', v_intervention_status));
  end if;

  select wo.planned_surface_m2, coalesce(wo.actual_road_surface_m2,0) + coalesce(wo.actual_sidewalk_surface_m2,0) + coalesce(wo.actual_other_surface_m2,0)
    into v_planned, v_actual
  from public.work_orders wo
  where wo.id = p_work_order_id;

  if coalesce(v_planned,0) > 0 and coalesce(v_actual,0) > 0 and abs(v_actual-v_planned)/v_planned >= 0.20 then
    v_warnings := v_warnings || jsonb_build_array(format('Écart de surface de %.0f %% entre le prévu et le réalisé : %s m² → %s m².', abs(v_actual-v_planned)/v_planned*100, round(v_planned,2), round(v_actual,2)));
  end if;

  v_error_count := jsonb_array_length(v_errors);
  return jsonb_build_object('ok', v_error_count = 0, 'errors', v_errors, 'warnings', v_warnings, 'line_count', v_line_count, 'expected_total', round(coalesce(v_expected_total,0),2), 'total_amount', round(coalesce(v_total,0),2));
end;
$$;

revoke all on function public.check_constat_before_validation(uuid,uuid) from public;
grant execute on function public.check_constat_before_validation(uuid,uuid) to authenticated;

create or replace function public.validate_constat_for_work_order(p_work_order_id uuid, p_constat_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_constat public.constats%rowtype;
  v_os_status text;
  v_check jsonb;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Utilisateur non authentifié';
  end if;

  if public.setom_current_role() not in ('admin','bureau','eau_de_toulouse') then
    raise exception 'Votre profil ne permet pas de valider ce constat.';
  end if;

  if not public.setom_can_access_work_order(p_work_order_id) then
    raise exception 'Cet OS n’est pas accessible à votre compte.';
  end if;

  select * into v_constat
  from public.constats
  where id = p_constat_id and work_order_id = p_work_order_id
  for update;

  if not found then
    raise exception 'Constat introuvable pour cet OS';
  end if;

  if v_constat.status <> 'À vérifier' then
    raise exception 'Le constat doit être au statut « À vérifier » avant validation (statut actuel : %).', coalesce(v_constat.status,'inconnu');
  end if;

  v_check := public.check_constat_before_validation(p_work_order_id,p_constat_id);
  if coalesce((v_check->>'ok')::boolean,false) is not true then
    raise exception 'Constat non conforme avant validation : %', coalesce(v_check->'errors','[]'::jsonb)::text;
  end if;

  update public.constats
  set status = 'Validé', validated_at = now(), validated_by = p_user_id, updated_at = now()
  where id = p_constat_id;

  select status into v_os_status from public.work_orders where id = p_work_order_id;

  return jsonb_build_object('constat_id', p_constat_id, 'constat_status', 'Validé', 'work_order_status', v_os_status, 'quality_check', v_check);
end;
$$;

revoke all on function public.validate_constat_for_work_order(uuid,uuid,uuid) from public;
grant execute on function public.validate_constat_for_work_order(uuid,uuid,uuid) to authenticated;
