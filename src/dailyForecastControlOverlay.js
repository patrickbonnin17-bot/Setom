import { supabase } from "./supabase";

const ID = "setom-daily-forecast-control";
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const money = (v) => `${n(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dateOf = () => String(document.querySelector("input[type=date][data-setom-selected-date], .planning-date-input")?.value || new Date().toISOString().slice(0,10)).slice(0,10);

function duration(date, start, end) {
  if (!start || !end) return 0;
  const a = new Date(`${date}T${String(start).slice(0,8)}`);
  let b = new Date(`${date}T${String(end).slice(0,8)}`);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return 0;
  if (b < a) b = new Date(b.getTime() + 86400000);
  const h = (b-a)/3600000;
  return h > 0 && h <= 24 ? h : 0;
}

async function load(date) {
  const r = await supabase.from("interventions").select("id,work_order_id,planned_order,planned_surface_m2,actual_surface_m2,arrival_time,departure_time,status").eq("planned_date",date).order("planned_order",{ascending:true});
  if (r.error) throw r.error;
  const ids = [...new Set((r.data||[]).map(x=>x.work_order_id).filter(Boolean))];
  if (!ids.length) return { rows:[], revenue:0 };
  const [w,c] = await Promise.all([
    supabase.from("work_orders").select("id,os_number,planned_surface_m2,actual_road_surface_m2,actual_sidewalk_surface_m2,actual_other_surface_m2,address,city").in("id",ids),
    supabase.from("constats").select("work_order_id,total_amount").in("work_order_id",ids)
  ]);
  if (w.error) throw w.error; if (c.error) throw c.error;
  const wm = new Map((w.data||[]).map(x=>[x.id,x]));
  const rev = new Map(); for (const x of c.data||[]) rev.set(x.work_order_id,Math.max(n(rev.get(x.work_order_id)),n(x.total_amount)));
  const rows = (r.data||[]).map((x,i)=>{
    const o=wm.get(x.work_order_id)||{};
    const planned=n(x.planned_surface_m2||o.planned_surface_m2);
    const actual=n(x.actual_surface_m2)||n(o.actual_road_surface_m2)+n(o.actual_sidewalk_surface_m2)+n(o.actual_other_surface_m2);
    return {...x,...o,planned,actual,hours:duration(date,x.arrival_time,x.departure_time),revenue:n(rev.get(x.work_order_id)),order:n(x.planned_order)||i+1};
  });
  return {rows,revenue:rows.reduce((s,x)=>s+x.revenue,0)};
}

function localCost(date){
  try { const d=JSON.parse(localStorage.getItem(`setom-daily-team-costs-v1:${date}`)||"null"); if(!d) return null; const total=["personnel_amount","vehicles_amount","materials_amount","equipment_amount","fuel_amount","other_amount"].reduce((s,k)=>s+n(d[k]),0); return {total,hours:n(d.hours)}; } catch { return null; }
}

function style(){
  if(document.getElementById(`${ID}-style`)) return;
  const s=document.createElement("style"); s.id=`${ID}-style`; s.textContent=`#${ID}{margin:12px 0;padding:14px;border:1px solid #dce5f1;border-radius:16px;background:#fff;box-shadow:0 7px 22px rgba(16,42,86,.06)}#${ID} .fc-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.fc-title{font-size:16px;font-weight:850;color:#102a56}.fc-sub{font-size:11px;color:#667085;margin-top:3px}.fc-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:10px}.fc-card{border:1px solid #e4eaf2;border-radius:11px;padding:9px}.fc-label{font-size:10px;color:#667085;font-weight:700}.fc-val{font-size:15px;font-weight:850;color:#102a56;margin-top:4px}.fc-ok{color:#087443}.fc-warn{color:#b54708}.fc-bad{color:#c0392b}.fc-table{overflow:auto;margin-top:10px}#${ID} table{width:100%;min-width:900px;border-collapse:collapse}#${ID} th,#${ID} td{padding:7px;border-bottom:1px solid #edf1f6;font-size:11px;text-align:right}#${ID} th:nth-child(1),#${ID} td:nth-child(1),#${ID} th:nth-child(2),#${ID} td:nth-child(2){text-align:left}@media(max-width:900px){#${ID} .fc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:500px){#${ID} .fc-grid{grid-template-columns:1fr}}`;
  document.head.appendChild(s);
}

async function render(){
  const host=document.querySelector(".planning-overlay, .planner-overlay, [data-setom-planning], .planning-container"); if(!host)return;
  style(); document.getElementById(ID)?.remove();
  const box=document.createElement("section"); box.id=ID; host.prepend(box);
  const date=dateOf(); box.innerHTML=`<div class="fc-title">🎯 Prévisionnel vs réalisé</div><div class="fc-sub">Contrôle de la journée : ce qui était prévu le matin et ce qui est réellement réalisé.</div><div class="fc-sub" style="margin-top:8px">Chargement…</div>`;
  try{
    const ctx=await load(date); if(!ctx.rows.length){box.querySelector(".fc-sub:last-child").textContent="Aucun OS planifié pour cette journée.";return;}
    const plannedSurface=ctx.rows.reduce((s,r)=>s+r.planned,0), actualSurface=ctx.rows.reduce((s,r)=>s+(r.actual||r.planned),0);
    const plannedHours=ctx.rows.reduce((s,r)=>s+r.hours,0), daily=localCost(date), actualHours=plannedHours;
    const plannedRevenue=ctx.revenue, actualRevenue=ctx.revenue;
    const surfaceGap=actualSurface-plannedSurface;
    const costRate=daily?.hours>0?daily.total/daily.hours:0;
    const estimatedCost=actualHours*costRate;
    const margin=actualRevenue-estimatedCost;
    const marginPct=actualRevenue>0?margin/actualRevenue*100:null;
    const surfacePct=plannedSurface>0?actualSurface/plannedSurface*100:0;
    const costCoverage=daily&&daily.hours>0?actualHours/daily.hours*100:null;
    box.innerHTML=`<div class="fc-head"><div><div class="fc-title">🎯 Prévisionnel vs réalisé</div><div class="fc-sub">Lecture rapide des écarts de la journée</div></div><button data-refresh style="border:0;border-radius:8px;padding:7px 11px;background:#0759d6;color:#fff;font-weight:700">Actualiser</button></div><div class="fc-grid"><div class="fc-card"><div class="fc-label">Surface prévue</div><div class="fc-val">${plannedSurface.toFixed(1)} m²</div></div><div class="fc-card"><div class="fc-label">Surface réalisée</div><div class="fc-val ${surfaceGap<0?"fc-warn":"fc-ok"}">${actualSurface.toFixed(1)} m²</div></div><div class="fc-card"><div class="fc-label">Écart surface</div><div class="fc-val ${surfaceGap<0?"fc-warn":"fc-ok"}">${surfaceGap>=0?"+":""}${surfaceGap.toFixed(1)} m²</div></div><div class="fc-card"><div class="fc-label">Heures réalisées</div><div class="fc-val">${actualHours.toFixed(2)} h</div></div><div class="fc-card"><div class="fc-label">Marge estimée</div><div class="fc-val ${margin<0?"fc-bad":"fc-ok"}">${money(margin)}${marginPct===null?"":` · ${marginPct.toFixed(1)} %`}</div></div></div><div class="fc-sub" style="margin-top:9px">${daily?`Coût horaire utilisé : ${money(costRate)}/h · ${costCoverage===null?"":`${costCoverage.toFixed(1)} % des heures journalières couvertes par les OS`}`:"Coût équipe non renseigné : marge prévisionnelle indisponible."}</div><div class="fc-table"><table><thead><tr><th>#</th><th>OS</th><th>Prévu m²</th><th>Réalisé m²</th><th>Écart m²</th><th>Heures</th><th>CA</th><th>Coût équipe</th><th>Marge</th></tr></thead><tbody>${ctx.rows.map(r=>{const s=r.actual||r.planned;const cost=r.hours*costRate;const m=r.revenue-cost;return `<tr><td>${r.order}</td><td>OS-${String(r.os_number??"").padStart(5,"0")}</td><td>${r.planned.toFixed(1)}</td><td>${s.toFixed(1)}</td><td>${(s-r.planned)>=0?"+":""}${(s-r.planned).toFixed(1)}</td><td>${r.hours.toFixed(2)}</td><td>${r.revenue?money(r.revenue):"—"}</td><td>${daily?money(cost):"—"}</td><td class="${m<0?"fc-bad":"fc-ok"}">${r.revenue?money(m):"—"}</td></tr>`}).join("")}</tbody></table></div>`;
    box.querySelector("[data-refresh]").onclick=render;
  }catch(e){box.innerHTML=`<div class="fc-title">🎯 Prévisionnel vs réalisé</div><div class="fc-sub fc-warn" style="margin-top:7px">Impossible de calculer le contrôle : ${e.message||e}</div>`;}
}

let timer;function schedule(){clearTimeout(timer);timer=setTimeout(()=>render().catch(()=>{}),650)}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.addEventListener("setom:planning-refresh",schedule);window.addEventListener("setom:planning-updated",schedule);window.addEventListener("storage",schedule);setTimeout(schedule,2100);
