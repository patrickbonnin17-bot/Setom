-- amount is a generated column (quantity * unit_price) in constat_lines.
-- Keep the automatic constat generator compatible with that schema by never
-- inserting an explicit value into the generated column.

CREATE OR REPLACE FUNCTION public.generate_constat_for_work_order(p_work_order_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_constat_id uuid;
  v_intervention_id uuid;
  v_zone text;
  v_material text;
  r record;
  v_bpu_id uuid;
  v_price numeric;
  v_actual numeric;
  v_billable numeric;
  v_ref numeric;
  v_coeff numeric;
  v_total numeric := 0;
  v_road numeric;
  v_sidewalk numeric;
  v_price_road numeric;
  v_price_sidewalk numeric;
  v_bpu_road uuid;
  v_bpu_sidewalk uuid;
  v_target text;
  v_red_surcharge numeric;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Utilisateur non authentifié';
  end if;
  if public.setom_current_role() in ('admin','bureau') then null;
  elsif public.setom_current_role() = 'equipe_terrain'
    and public.setom_can_access_work_order(p_work_order_id)
    and exists (select 1 from public.interventions where work_order_id=p_work_order_id and team_id=public.setom_current_team_id() and status='Travaux effectués') then null;
  else raise exception 'Votre profil ne permet pas de générer le constat de cet OS.';
  end if;

  select i.id into v_intervention_id from public.interventions i where i.work_order_id=p_work_order_id order by i.updated_at desc nulls last,i.created_at desc limit 1;
  if v_intervention_id is null then raise exception 'Aucune intervention pour cet OS'; end if;

  select wo.rehabilitation_zone,wo.material_detail,coalesce(wo.actual_road_surface_m2,0),coalesce(wo.actual_sidewalk_surface_m2,0)
    into v_zone,v_material,v_road,v_sidewalk from public.work_orders wo where wo.id=p_work_order_id;

  select c.id into v_constat_id from public.constats c where c.work_order_id=p_work_order_id order by c.created_at desc limit 1;
  if v_constat_id is null then
    insert into public.constats(work_order_id,intervention_id,status,constat_date,created_by) values(p_work_order_id,v_intervention_id,'Brouillon',current_date,p_user_id) returning id into v_constat_id;
  else
    update public.constats set intervention_id=v_intervention_id,status='Brouillon',updated_at=now() where id=v_constat_id;
    delete from public.constat_lines where constat_id=v_constat_id;
  end if;

  for r in select * from public.work_realizations where intervention_id=v_intervention_id order by id loop
    v_material:=lower(trim(coalesce(r.designation,''))); v_actual:=coalesce(r.surface_m2,r.quantity,0); v_billable:=coalesce(r.quantity,0);
    v_coeff:=1; v_ref:=null; v_bpu_id:=null; v_price:=null; v_target:=null; v_red_surcharge:=null;
    if lower(coalesce(r.unit,''))='m²' then
      if v_material like '%enrob%' or v_material like '%ge calcaire%' then v_ref:=6;
      elsif v_material like '%béton%' or v_material like '%beton%' then v_ref:=10; end if;
      if v_ref is not null and coalesce(r.thickness_cm,0)>0 then v_coeff:=greatest(1,r.thickness_cm/v_ref); v_billable:=v_actual*v_coeff; else v_billable:=v_actual; end if;
    end if;
    if v_material like '%béton désactiv%' or v_material like '%beton desactiv%' then v_target:='desactive';
    elsif v_material like '%béton balay%' or v_material like '%beton balay%' or v_material like '%béton taloch%' or v_material like '%beton taloch%' or v_material like '%béton color%' or v_material like '%beton color%' then v_target:='beton_gris';
    elsif v_material like '%asphalte%' then v_target:='asphalte';
    elsif v_material like '%sous-dallage%' or v_material like '%sous dallage%' then v_target:='sous_dallage';
    elsif v_material like '%enrob%' or v_material like '%ge calcaire%' then v_target:='enrobe'; if v_material like '%rouge%' then v_red_surcharge:=12.43; end if; end if;

    if lower(coalesce(r.unit,''))='m²' and v_target='enrobe' and v_zone='Chaussée + trottoir' then
      select bl.id,case when v_road<=8 then bl.price_le_8_m2 when v_road<=15 then coalesce(bl.price_8_15_m2,bl.price_le_8_m2) else coalesce(bl.price_gt_15_m2,bl.price_8_15_m2,bl.price_le_8_m2) end into v_bpu_road,v_price_road from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and lower(bl.designation) like '%réfection définitive%chaussée%en enrobés%' limit 1;
      select bl.id,case when v_sidewalk<=8 then bl.price_le_8_m2 when v_sidewalk<=15 then coalesce(bl.price_8_15_m2,bl.price_le_8_m2) else coalesce(bl.price_gt_15_m2,bl.price_8_15_m2,bl.price_le_8_m2) end into v_bpu_sidewalk,v_price_sidewalk from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and lower(bl.designation) like '%réfection de trottoir en enrobé%' limit 1;
      if v_road>0 and v_bpu_road is not null then
        insert into public.constat_lines(constat_id,bpu_line_id,designation,quantity,unit,unit_price,thickness_cm,observations,actual_quantity,billing_coefficient,reference_thickness_cm,actual_thickness_cm) values(v_constat_id,v_bpu_road,'Enrobé - chaussée',v_road,'m²',coalesce(v_price_road,0),r.thickness_cm,r.observations,v_actual,v_coeff,v_ref,r.thickness_cm);
        v_total:=v_total+round(v_road*v_coeff*coalesce(v_price_road,0),2);
        if v_red_surcharge is not null then
          insert into public.constat_lines(constat_id,bpu_line_id,designation,quantity,unit,unit_price,thickness_cm,observations,actual_quantity,billing_coefficient,reference_thickness_cm,actual_thickness_cm) values(v_constat_id,(select bl.id from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and lower(bl.designation) like '%plus value pour enrobé rouge%' limit 1),'Plus-value enrobé rouge - chaussée',v_road,'m²',v_red_surcharge,r.thickness_cm,r.observations,v_actual,v_coeff,v_ref,r.thickness_cm);
          v_total:=v_total+round(v_road*v_coeff*v_red_surcharge,2);
        end if;
      end if;
      if v_sidewalk>0 and v_bpu_sidewalk is not null then
        insert into public.constat_lines(constat_id,bpu_line_id,designation,quantity,unit,unit_price,thickness_cm,observations,actual_quantity,billing_coefficient,reference_thickness_cm,actual_thickness_cm) values(v_constat_id,v_bpu_sidewalk,'Enrobé - trottoir',v_sidewalk,'m²',coalesce(v_price_sidewalk,0),r.thickness_cm,r.observations,v_actual,v_coeff,v_ref,r.thickness_cm);
        v_total:=v_total+round(v_sidewalk*v_coeff*coalesce(v_price_sidewalk,0),2);
        if v_red_surcharge is not null then
          insert into public.constat_lines(constat_id,bpu_line_id,designation,quantity,unit,unit_price,thickness_cm,observations,actual_quantity,billing_coefficient,reference_thickness_cm,actual_thickness_cm) values(v_constat_id,(select bl.id from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and lower(bl.designation) like '%plus value pour enrobé rouge%' limit 1),'Plus-value enrobé rouge - trottoir',v_sidewalk,'m²',v_red_surcharge,r.thickness_cm,r.observations,v_actual,v_coeff,v_ref,r.thickness_cm);
          v_total:=v_total+round(v_sidewalk*v_coeff*v_red_surcharge,2);
        end if;
      end if;
      continue;
    end if;

    if v_target='desactive' then
      select bl.id,bl.unit_price into v_bpu_id,v_price from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and lower(bl.designation) like '%trottoirs en béton finition désactivé%' limit 1;
    elsif v_target='beton_gris' then
      select bl.id,case when v_actual<=8 then bl.price_le_8_m2 when v_actual<=15 then coalesce(bl.price_8_15_m2,bl.price_le_8_m2) else coalesce(bl.price_gt_15_m2,bl.price_8_15_m2,bl.price_le_8_m2) end into v_bpu_id,v_price from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and lower(bl.designation) like '%trottoirs en béton ciment gris%' limit 1;
    elsif v_target='asphalte' then
      select bl.id,case when v_actual<=8 then bl.price_le_8_m2 when v_actual<=15 then coalesce(bl.price_8_15_m2,bl.price_le_8_m2) else coalesce(bl.price_gt_15_m2,bl.price_8_15_m2,bl.price_le_8_m2) end into v_bpu_id,v_price from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and lower(bl.designation) like '%réfection de trottoir en asphalte%' limit 1;
    elsif v_target='sous_dallage' then
      select bl.id,case when v_actual<=8 then bl.price_le_8_m2 when v_actual<=15 then coalesce(bl.price_8_15_m2,bl.price_le_8_m2) else coalesce(bl.price_gt_15_m2,bl.price_8_15_m2,bl.price_le_8_m2) end into v_bpu_id,v_price from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and lower(bl.designation) like '%sous dallage en béton de ciment%' limit 1;
    elsif v_target='enrobe' then
      if lower(coalesce(v_zone,'')) like '%trottoir%' and lower(coalesce(v_zone,'')) not like '%chaussée%' then
        select bl.id,case when v_actual<=8 then bl.price_le_8_m2 when v_actual<=15 then coalesce(bl.price_8_15_m2,bl.price_le_8_m2) else coalesce(bl.price_gt_15_m2,bl.price_8_15_m2,bl.price_le_8_m2) end into v_bpu_id,v_price from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and lower(bl.designation) like '%réfection de trottoir en enrobé%' limit 1;
      else
        select bl.id,case when v_actual<=8 then bl.price_le_8_m2 when v_actual<=15 then coalesce(bl.price_8_15_m2,bl.price_le_8_m2) else coalesce(bl.price_gt_15_m2,bl.price_8_15_m2,bl.price_le_8_m2) end into v_bpu_id,v_price from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and lower(bl.designation) like '%réfection définitive%chaussée%en enrobés%' limit 1;
      end if;
    end if;

    if v_bpu_id is null then
      select bl.id,case when lower(coalesce(bl.unit,''))='m²' then case when v_actual<=8 then bl.price_le_8_m2 when v_actual<=15 then coalesce(bl.price_8_15_m2,bl.price_le_8_m2) else coalesce(bl.price_gt_15_m2,bl.price_8_15_m2,bl.price_le_8_m2) end else bl.unit_price end into v_bpu_id,v_price from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and (lower(bl.designation)=lower(r.designation) or (lower(r.designation) like '%sciage%' and lower(bl.designation) like '%sciage%') or (lower(r.designation) like '%joint%' and lower(bl.designation) like '%joint%') or (lower(r.designation) like '%bouch%clé%' and lower(bl.designation) like '%bouche à clé%') or (lower(r.designation) like '%démolition%' and lower(bl.designation) like '%démolition%')) order by case when lower(bl.designation)=lower(r.designation) then 0 else 1 end limit 1;
    end if;

    insert into public.constat_lines(constat_id,bpu_line_id,designation,quantity,unit,unit_price,thickness_cm,observations,actual_quantity,billing_coefficient,reference_thickness_cm,actual_thickness_cm) values(v_constat_id,v_bpu_id,r.designation,v_billable,r.unit,coalesce(v_price,0),r.thickness_cm,r.observations,v_actual,v_coeff,v_ref,r.thickness_cm);
    v_total:=v_total+round(v_billable*coalesce(v_price,0),2);
    if v_target='enrobe' and v_red_surcharge is not null and v_bpu_id is not null then
      insert into public.constat_lines(constat_id,bpu_line_id,designation,quantity,unit,unit_price,thickness_cm,observations,actual_quantity,billing_coefficient,reference_thickness_cm,actual_thickness_cm) values(v_constat_id,(select bl.id from public.bpu_lines bl join public.bpu_versions bv on bv.id=bl.version_id where bl.active and bv.is_current and lower(bl.designation) like '%plus value pour enrobé rouge%' limit 1),'Plus-value enrobé rouge',v_billable,'m²',v_red_surcharge,r.thickness_cm,r.observations,v_actual,v_coeff,v_ref,r.thickness_cm);
      v_total:=v_total+round(v_billable*v_red_surcharge,2);
    end if;
  end loop;

  update public.constats set total_amount=round(v_total,2),updated_at=now() where id=v_constat_id;
  return v_constat_id;
end;
$function$;
