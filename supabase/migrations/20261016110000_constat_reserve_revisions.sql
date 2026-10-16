create table if not exists public.constat_revisions (
  id uuid primary key default gen_random_uuid(),
  constat_id uuid not null references public.constats(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  revision_number integer not null,
  action text not null check (action in ('reserve','reprise_photos','modification','revalidation')),
  reason text null,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(constat_id, revision_number)
);

create index if not exists constat_revisions_constat_idx on public.constat_revisions(constat_id, created_at desc);
alter table public.constat_revisions enable row level security;

create or replace function public.update_constat_after_reserve(p_work_order_id uuid, p_constat_id uuid, p_observations text, p_lines jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_constat public.constats%rowtype;
  v_line jsonb;
  v_total numeric := 0;
  v_amount numeric;
  v_next_revision integer;
  v_snapshot jsonb;
begin
  if auth.uid() is null then raise exception 'Utilisateur non authentifié'; end if;
  if public.setom_current_role() not in ('admin','bureau') then raise exception 'Seul le bureau peut modifier le constat.'; end if;
  if not public.setom_can_access_work_order(p_work_order_id) then raise exception 'Cet OS n’est pas accessible à votre compte.'; end if;
  select * into v_constat from public.constats where id=p_constat_id and work_order_id=p_work_order_id for update;
  if not found then raise exception 'Constat introuvable pour cet OS'; end if;
  if v_constat.status <> 'Validé avec réserve' or v_constat.reserve_resolved_at is not null then raise exception 'Le constat doit être en réserve non levée pour être modifié.'; end if;
  select coalesce(max(revision_number),0)+1 into v_next_revision from public.constat_revisions where constat_id=p_constat_id;
  select jsonb_build_object('constat',to_jsonb(c),'lines',coalesce((select jsonb_agg(to_jsonb(cl) order by cl.id) from public.constat_lines cl where cl.constat_id=c.id),'[]'::jsonb)) into v_snapshot from public.constats c where c.id=p_constat_id;
  insert into public.constat_revisions(constat_id,work_order_id,revision_number,action,reason,snapshot,created_by) values(p_constat_id,p_work_order_id,v_next_revision,'modification',v_constat.reserve_reason,v_snapshot,auth.uid());
  if jsonb_typeof(coalesce(p_lines,'[]'::jsonb)) <> 'array' then raise exception 'La liste des prestations est invalide'; end if;
  delete from public.constat_lines where constat_id=p_constat_id;
  for v_line in select * from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb)) loop
    v_amount := round(coalesce((v_line->>'quantity')::numeric,0)*coalesce((v_line->>'unit_price')::numeric,0),2);
    v_total := v_total + v_amount;
    insert into public.constat_lines(constat_id,bpu_line_id,designation,quantity,unit,unit_price,thickness_cm,observations,actual_quantity,billing_coefficient,reference_thickness_cm,actual_thickness_cm)
    values(p_constat_id,nullif(v_line->>'bpu_line_id','')::uuid,coalesce(v_line->>'designation','Prestation'),coalesce((v_line->>'quantity')::numeric,0),coalesce(v_line->>'unit',''),coalesce((v_line->>'unit_price')::numeric,0),nullif(v_line->>'thickness_cm','')::numeric,nullif(v_line->>'observations',''),nullif(v_line->>'actual_quantity','')::numeric,nullif(v_line->>'billing_coefficient','')::numeric,nullif(v_line->>'reference_thickness_cm','')::numeric,nullif(v_line->>'actual_thickness_cm','')::numeric);
  end loop;
  update public.constats set observations=p_observations,total_amount=round(v_total,2),status='À vérifier',validated_at=null,validated_by=null,reserve_resolved_at=null,reserve_resolved_by=null,updated_at=now() where id=p_constat_id;
  update public.work_orders set status='À vérifier',updated_at=now() where id=p_work_order_id;
  return (select jsonb_build_object('constat',to_jsonb(c),'lines',coalesce((select jsonb_agg(to_jsonb(cl) order by cl.id) from public.constat_lines cl where cl.constat_id=c.id),'[]'::jsonb)) from public.constats c where c.id=p_constat_id);
end; $$;

grant execute on function public.update_constat_after_reserve(uuid,uuid,text,jsonb) to authenticated;
