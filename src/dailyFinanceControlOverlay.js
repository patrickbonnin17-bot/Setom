import { supabase } from "./supabase";

const ID = "setom-finance-control";
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const money = (v) => `${n(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dateOf = () => String(document.querySelector("input[type=date][data-setom-selected-date], .planning-date-input")?.value || new Date().toISOString().slice(0,10)).slice(0,10);

function dailyLocal(date) {
  try {
    const d = JSON.parse(localStorage.getItem(`setom-daily-team-costs-v1:${date}`) || "null");
    if (!d) return null;
    const total = ["personnel_amount","vehicles_amount","materials_amount","equipment_amount","fuel_amount","other_amount"].reduce((s,k)=>s+n(d[k]),0);
    return { total, hours:n(d.hours) };
  } catch { return null; }
}

async function read(date) {
  const local = dailyLocal(date);
  const ir = await supabase.from("interventions").select("id,work_order_id,arrival_time,departure_time").eq("planned_date", date);
  if (ir.error) throw ir.error;
  const ids = [...new Set((ir.data || []).map(x=>x.work_order_id).filter(Boolean))];
  if (!ids.length) return { local, allocated:0, allocatedHours:0, interventionHours:0, count:0 };
  const cr = await supabase.from("work_order_costs").select("amount,quantity,unit,description").eq("cost_date",date).in("work_order_id",ids).like("description","Équipe %");
  if (cr.error) throw cr.error;
  const allocated = (cr.data || []).reduce((s,x)=>s+n(x.amount),0);
  const allocatedHours = (cr.data || []).reduce((s,x)=>s+(String(x.unit||"").toLowerCase()==="h" ? n(x.quantity) : 0),0);
  const interventionHours = (ir.data || []).reduce((s,x)=>{
    if (!x.arrival_time || !x.departure_time) return s;
    const a = new Date(`${date}T${String(x.arrival_time).slice(0,8)}`);
    let b = new Date(`${date}T${String(x.departure_time).slice(0,8)}`);
    if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return s;
    if (b < a) b = new Date(b.getTime()+24*3600000);
    const h = (b-a)/3600000;
    return s + (h > 0 && h <= 24 ? h : 0);
  },0);
  return { local, allocated, allocatedHours, interventionHours, count:ids.length };
}

function style(){
  if(document.getElementById(`${ID}-style`)) return;
  const s=document.createElement("style"); s.id=`${ID}-style`; s.textContent=`
#${ID}{margin:10px 0;padding:12px 14px;border:1px solid #dce5f1;border-radius:14px;background:#fff;font-family:inherit}
#${ID} .fc-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.fc-title{font-size:14px;font-weight:850;color:#102a56}.fc-sub{font-size:11px;color:#667085;margin-top:2px}
#${ID} .fc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px}.fc-card{padding:9px;border:1px solid #e6ebf2;border-radius:10px;background:#f9fbfe}.fc-label{font-size:9px;color:#667085;text-transform:uppercase;font-weight:750}.fc-value{font-size:14px;font-weight:850;color:#102a56;margin-top:3px}.fc-good{color:#087443}.fc-warn{color:#b54708}.fc-bad{color:#c0392b}.fc-note{margin-top:9px;font-size:11px;color:#667085}.fc-refresh{border:0;border-radius:8px;padding:7px 10px;background:#eef4ff;color:#0759d6;font-weight:750;cursor:pointer}
@media(max-width:850px){#${ID} .fc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:500px){#${ID} .fc-grid{grid-template-columns:1fr}}
`; document.head.appendChild(s);
}

function render(data,date){
  const host=document.querySelector(".planning-overlay, .planner-overlay, [data-setom-planning], .planning-container");
  if(!host) return;
  style();
  document.getElementById(ID)?.remove();
  const box=document.createElement("section"); box.id=ID;
  const total=data.local?.total || 0;
  const hours=data.local?.hours || 0;
  const delta=total-data.allocated;
  const costPct=total>0 ? data.allocated/total*100 : 0;
  const hourDelta=hours-data.allocatedHours;
  const ready=total>0 && Math.abs(delta)<=0.05 && Math.abs(hourDelta)<=0.05;
  const status=ready ? "✓ COHÉRENT" : total>0 ? "⚠ À CONTRÔLER" : "○ EN ATTENTE";
  const statusClass=ready ? "fc-good" : total>0 ? "fc-warn" : "";
  box.innerHTML=`<div class="fc-head"><div><div class="fc-title">🔎 Contrôle financier de la journée</div><div class="fc-sub">Réconciliation du coût global saisi avec les coûts équipe affectés aux OS</div></div><button class="fc-refresh">Actualiser</button></div>
  <div class="fc-grid">
    <div class="fc-card"><div class="fc-label">Coût global</div><div class="fc-value">${total?money(total):"—"}</div></div>
    <div class="fc-card"><div class="fc-label">Coût affecté aux OS</div><div class="fc-value">${data.allocated?money(data.allocated):"—"}</div></div>
    <div class="fc-card"><div class="fc-label">Écart</div><div class="fc-value ${Math.abs(delta)<=0.05?"fc-good":"fc-warn"}">${total?money(delta):"—"}</div></div>
    <div class="fc-card"><div class="fc-label">Couverture financière</div><div class="fc-value ${costPct>=99.99?"fc-good":costPct>0?"fc-warn":""}">${total?`${costPct.toFixed(1)} %`:"—"}</div></div>
    <div class="fc-card"><div class="fc-label">Heures saisies</div><div class="fc-value">${hours?hours.toFixed(2):"—"} h</div></div>
    <div class="fc-card"><div class="fc-label">Heures affectées</div><div class="fc-value">${data.allocatedHours?data.allocatedHours.toFixed(2):"—"} h</div></div>
    <div class="fc-card"><div class="fc-label">Écart heures</div><div class="fc-value ${Math.abs(hourDelta)<=0.05?"fc-good":"fc-warn"}">${hours?`${hourDelta>=0?"+":""}${hourDelta.toFixed(2)} h`:"—"}</div></div>
    <div class="fc-card"><div class="fc-label">Statut</div><div class="fc-value ${statusClass}">${status}</div></div>
  </div>
  <div class="fc-note">Règle : le coût journalier global comprend déjà personnel, véhicules, matériaux, matériel, carburant et autres frais. Il n'est donc pas redéduit une seconde fois comme coût matière dans la marge.</div>`;
  box.querySelector(".fc-refresh").onclick=()=>schedule();
  host.prepend(box);
}

async function patch(){
  const date=dateOf();
  try { render(await read(date),date); } catch(e) {
    const host=document.querySelector(".planning-overlay, .planner-overlay, [data-setom-planning], .planning-container");
    if(!host) return;
    style(); document.getElementById(ID)?.remove();
    const box=document.createElement("section"); box.id=ID; box.innerHTML=`<div class="fc-title">🔎 Contrôle financier</div><div class="fc-sub fc-warn" style="margin-top:6px">Impossible de vérifier les affectations : ${e.message||e}</div>`; host.prepend(box);
  }
}
let timer;
function schedule(){clearTimeout(timer);timer=setTimeout(()=>patch(),500)}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.addEventListener("setom:planning-refresh",schedule);
window.addEventListener("setom:planning-updated",schedule);
window.addEventListener("setom:daily-team-cost-saved",schedule);
window.addEventListener("storage",schedule);
setTimeout(schedule,2200);
