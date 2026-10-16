import { supabase } from "./supabase";

const ROOT = "setom-profitability-widget";
const STYLE = `${ROOT}-style`;
const LABOR_RATE_KEY = "setom-labor-rate";
const WORKED_STATUSES = ["Travaux réalisés", "À vérifier", "Validé", "Réserve", "Payé", "Archivé"];
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const money = (v) => `${n(v).toFixed(2)} €`;
const esc = (v) => String(v ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const mins = (a,b) => { if(!a || !b) return 0; const [ah,am] = String(a).slice(0,5).split(":").map(Number); const [bh,bm] = String(b).slice(0,5).split(":").map(Number); if(!Number.isFinite(ah)||!Number.isFinite(am)||!Number.isFinite(bh)||!Number.isFinite(bm)) return 0; let x=(bh*60+bm)-(ah*60+am); if(x<0)x+=1440; return x; };

function styles(){
 if(document.getElementById(STYLE)) return;
 const s=document.createElement("style"); s.id=STYLE; s.textContent=`
 #${ROOT}-btn{position:fixed;right:18px;bottom:18px;z-index:99989;border:0;border-radius:999px;padding:12px 16px;background:#175cd3;color:#fff;font-weight:800;box-shadow:0 8px 26px rgba(0,0,0,.2);cursor:pointer}
 #${ROOT}-panel{position:fixed;inset:14px;z-index:99990;background:#f8fafc;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.3);overflow:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17202a}
 #${ROOT}-panel .pf-head{position:sticky;top:0;background:#fff;border-bottom:1px solid #e4e7ec;padding:15px 18px;display:flex;justify-content:space-between;align-items:center;z-index:2}
 #${ROOT}-panel .pf-body{max-width:1400px;margin:auto;padding:18px}.pf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}.pf-card{background:#fff;border:1px solid #e4e7ec;border-radius:14px;padding:14px;margin-bottom:12px}.pf-table{width:100%;border-collapse:collapse;min-width:1050px}.pf-table th,.pf-table td{padding:9px;border-bottom:1px solid #edf0f4;text-align:left;font-size:13px}.pf-input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #d0d5dd;border-radius:8px}.pf-btn{border:1px solid #d0d5dd;border-radius:8px;padding:8px 11px;background:#fff;font-weight:700;cursor:pointer}.pf-good{color:#027a48;font-weight:800}.pf-bad{color:#b42318;font-weight:800}.pf-muted{color:#667085;font-size:12px}.pf-warn{color:#b54708;font-weight:800}
 @media(max-width:700px){#${ROOT}-panel{inset:0;border-radius:0}.pf-body{padding:12px}}
 `; document.head.appendChild(s);
}

async function load(date){
 const [o,c,l,i,m,t] = await Promise.all([
  supabase.from("work_orders").select("id,os_number,status,sector_id,planned_surface_m2,material_id,material_detail,actual_road_surface_m2,actual_sidewalk_surface_m2,actual_other_surface_m2").order("os_number",{ascending:true}),
  supabase.from("constats").select("id,work_order_id,status,constat_date,total_amount,validated_at,created_at").in("status",["Validé","Payé","Archivé"]).order("created_at",{ascending:false}),
  supabase.from("constat_lines").select("constat_id,bpu_line_id,designation,quantity,unit,unit_price,amount,actual_quantity,billing_coefficient,actual_thickness_cm"),
  supabase.from("interventions").select("id,work_order_id,team_id,planned_date,actual_date,arrival_time,departure_time,actual_surface_m2"),
  supabase.from("materials").select("id,name,category,purchase_price_per_t,density_t_m3,default_thickness_cm"),
  supabase.from("truck_material_consumptions").select("work_order_id,material_id,consumption_date,quantity,estimated").eq("consumption_date",date)
 ]);
 for(const r of [o,c,l,i,m,t]) if(r.error) throw r.error;
 const validConstatByOS=new Map(); for(const x of c.data||[]) if(!validConstatByOS.has(x.work_order_id)) validConstatByOS.set(x.work_order_id,x);
 const linesByConstat=new Map(); for(const x of l.data||[]) { const a=linesByConstat.get(x.constat_id)||[]; a.push(x); linesByConstat.set(x.constat_id,a); }
 const intByOS=new Map(); for(const x of i.data||[]) { const a=intByOS.get(x.work_order_id)||[]; a.push(x); intByOS.set(x.work_order_id,a); }
 const materialById=new Map((m.data||[]).map(x=>[x.id,x]));
 const consByOS=new Map(); for(const x of t.data||[]) { const a=consByOS.get(x.work_order_id)||[]; a.push(x); consByOS.set(x.work_order_id,a); }
 return {orders:o.data||[], constats:validConstatByOS, lines:linesByConstat, interventions:intByOS, materials:materialById, consumptions:consByOS};
}

function rowFor(order,data,date){
 const constat=data.constats.get(order.id);
 const allInts=data.interventions.get(order.id)||[];
 const dayInts=allInts.filter(x=>String(x.actual_date||"").slice(0,10)===date||(!x.actual_date&&WORKED_STATUSES.includes(order.status)&&String(x.planned_date||"").slice(0,10)===date));
 const lineTotal=(data.lines.get(constat?.id)||[]).reduce((s,x)=>s+n(x.amount),0);
 const revenue=constat?(n(constat.total_amount)||lineTotal):0;
 const siteMinutes=dayInts.reduce((s,x)=>s+mins(x.arrival_time,x.departure_time),0);
 const actualCons=data.consumptions.get(order.id)||[];
 const materialDetail=String(order.material_detail||"").toLowerCase();
 const material=data.materials.get(order.material_id)||[...data.materials.values()].find(m=>{
  const name=String(m.name||"").toLowerCase(), category=String(m.category||"").toLowerCase();
  return (name&&materialDetail.includes(name))||(category&&materialDetail.includes(category));
 })||null;
 const hasActualMaterial=actualCons.length>0&&actualCons.every(x=>x.estimated===false);
 const hasAnyActualMaterial=actualCons.some(x=>x.estimated===false);
 const hasAnyEstimatedMaterial=actualCons.some(x=>x.estimated!==false);
 let materialQty=0,materialCost=0,materialEstimateAvailable=false,materialCostComplete=true,materialSource="absent";
 if(actualCons.length){
  materialSource=hasAnyActualMaterial&&hasAnyEstimatedMaterial?"mixte":hasAnyActualMaterial?"réel":"estimé";
  for(const x of actualCons){
   const mat=data.materials.get(x.material_id);
   materialQty+=n(x.quantity);
   if(!mat||mat.purchase_price_per_t==null||!Number.isFinite(Number(mat.purchase_price_per_t))){materialCostComplete=false;continue;}
   materialCost+=n(x.quantity)*n(mat.purchase_price_per_t);
  }
  materialEstimateAvailable=materialCostComplete&&materialSource!=="réel";
 }else{
  const measuredSurface=n(order.actual_road_surface_m2)+n(order.actual_sidewalk_surface_m2)+n(order.actual_other_surface_m2);
  const interventionSurface=dayInts.reduce((sum,x)=>sum+n(x.actual_surface_m2),0);
  const surface=measuredSurface>0?measuredSurface:(interventionSurface>0?interventionSurface:n(order.planned_surface_m2));
  const thickness=n(material?.default_thickness_cm);
  const density=n(material?.density_t_m3);
  const priceRaw=material?.purchase_price_per_t;
  const price=n(priceRaw);
  materialEstimateAvailable=Boolean(material&&surface>0&&thickness>0&&density>0&&priceRaw!=null&&Number.isFinite(Number(priceRaw)));
  materialCostComplete=materialEstimateAvailable;
  if(materialEstimateAvailable){
   materialQty=surface*thickness/100*density;
   materialCost=materialQty*price;
   materialSource="estimé";
  }else{materialSource="incomplet";materialCostComplete=false;}
 }
 return {order,constat,ints:dayInts,revenue,siteMinutes,laborCost:0,materialCost,materialQty,hasActualMaterial,materialSource,materialCostComplete,materialEstimateAvailable,totalCost:materialCost,margin:revenue-materialCost,marginPct:revenue?(revenue-materialCost)/revenue*100:0,timeProvisional:false};
}

function allocateLaborCosts(rows,rate){
 const teams=new Map();
 let incompleteInterventions=0;
 for(const row of rows){
  for(const intervention of row.ints){
   const hasTimes=Boolean(intervention.arrival_time&&intervention.departure_time);
   const duration=hasTimes?mins(intervention.arrival_time,intervention.departure_time):0;
   if(!intervention.team_id){
    incompleteInterventions++;
    row.timeProvisional=true;
    if(hasTimes)row.laborCost+=duration/60*rate;
    continue;
   }
   const key=intervention.team_id;
   if(!teams.has(key))teams.set(key,[]);
   teams.get(key).push({row,intervention,hasTimes,duration});
  }
 }
 for(const entries of teams.values()){
  const missing=entries.filter(x=>!x.hasTimes);
  const known=entries.filter(x=>x.hasTimes);
  if(missing.length){
   incompleteInterventions+=missing.length;
   for(const x of entries)x.row.timeProvisional=true;
   for(const x of known)x.row.laborCost+=x.duration/60*rate;
   continue;
  }
  const siteTotal=entries.reduce((sum,x)=>sum+x.duration,0);
  if(siteTotal<=0){for(const x of entries)x.row.timeProvisional=true;incompleteInterventions++;continue;}
  const starts=entries.map(x=>minsSinceMidnight(x.intervention.arrival_time));
  const ends=entries.map(x=>minsSinceMidnight(x.intervention.departure_time));
  const first=Math.min(...starts);
  const last=Math.max(...ends);
  let amplitude=last-first;
  if(amplitude<0)amplitude+=1440;
  const paidMinutes=Math.max(0,amplitude-60);
  const fullTeamDayCost=paidMinutes/60*rate;
  for(const x of entries)x.row.laborCost+=fullTeamDayCost*x.duration/siteTotal;
 }
 for(const row of rows){
  row.totalCost=row.materialCost+row.laborCost;
  row.margin=row.revenue-row.totalCost;
  row.marginPct=row.revenue?row.margin/row.revenue*100:0;
 }
 return {incompleteInterventions};
}

function minsSinceMidnight(value){
 if(!value)return 0;
 const [h,m]=String(value).slice(0,5).split(":").map(Number);
 return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:0;
}
function renderTable(rows){
 return rows.map(r=>`<tr><td><strong>OS ${esc(r.order.os_number)}</strong></td><td>${r.constat?esc(r.constat.status):"<span class='pf-muted'>Pas de constat validé</span>"}</td><td>${r.revenue?money(r.revenue):"—"}</td><td>${r.materialCost?money(r.materialCost):"—"}${r.materialQty?`<div class='pf-muted'>${r.materialQty.toFixed(2)} t${r.materialSource==="réel"?" réel":r.materialSource==="mixte"?" mixte":" estimé"}</div>`:""}</td><td>${r.laborCost?money(r.laborCost):"—"}<div class='pf-muted'>${(r.siteMinutes/60).toFixed(2)} h</div></td><td>${r.totalCost?money(r.totalCost):"—"}</td><td class='${r.margin<0?"pf-bad":"pf-good"}'>${r.revenue?money(r.margin):"—"}<div>${r.revenue?r.marginPct.toFixed(1)+" %":""}</div></td></tr>`).join("") || `<tr><td colspan="7">Aucun OS.</td></tr>`;
}

async function render(date){
 const root=document.getElementById(ROOT); if(!root)return;
 root.innerHTML=`<div id="${ROOT}-panel"><div class="pf-head"><div><strong style="font-size:19px">💶 Rentabilité SETOM</strong><div class="pf-muted">CA constat validé → matériaux → main-d'œuvre → marge</div></div><button id="pf-close" class="pf-btn">Fermer</button></div><div class="pf-body"><div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:14px"><div><label class="pf-muted">Journée</label><input id="pf-date" class="pf-input" type="date" value="${esc(date)}"></div><div><label class="pf-muted">Coût horaire main-d'œuvre</label><input id="pf-rate" class="pf-input" type="number" min="0" step="1" value="${n(localStorage.getItem(LABOR_RATE_KEY)??45)}"></div><button id="pf-refresh" class="pf-btn">↻ Actualiser</button></div><div id="pf-content">Chargement…</div></div></div>`;
 root.querySelector("#pf-close").onclick=close; root.querySelector("#pf-date").onchange=e=>render(e.target.value); root.querySelector("#pf-rate").onchange=e=>{localStorage.setItem(LABOR_RATE_KEY,String(e.target.value).trim()===""?45:n(e.target.value));render(root.querySelector("#pf-date").value);}; root.querySelector("#pf-refresh").onclick=()=>render(root.querySelector("#pf-date").value);
 try{
  const data=await load(date); const all=data.orders.map(o=>rowFor(o,data,date)); const rows=all.filter(r=>r.ints.length>0); const allocation=allocateLaborCosts(rows,n(localStorage.getItem(LABOR_RATE_KEY)??45));
  const day=rows.filter(r=>r.constat);
  const revenue=day.reduce((s,r)=>s+r.revenue,0);
  // Inclure les coûts de tous les OS travaillés, même si leur constat n'est pas encore validé.
  const mat=rows.reduce((s,r)=>s+r.materialCost,0), labor=rows.reduce((s,r)=>s+r.laborCost,0), cost=mat+labor, margin=revenue-cost;
  const missingRevenue=rows.filter(r=>!r.constat).length;
  const missingMaterial=rows.filter(r=>r.materialSource!=="réel").length;
  const missingMaterialParameters=rows.filter(r=>!r.materialCostComplete).length;
  root.querySelector("#pf-content").innerHTML=`<div class="pf-grid"><div class="pf-card"><div class="pf-muted">OS travaillés</div><strong style="font-size:28px">${rows.length}</strong></div><div class="pf-card"><div class="pf-muted">CA HT constaté</div><strong style="font-size:28px">${money(revenue)}</strong></div><div class="pf-card"><div class="pf-muted">Coût matière</div><strong style="font-size:28px">${money(mat)}</strong></div><div class="pf-card"><div class="pf-muted">Main-d'œuvre</div><strong style="font-size:28px">${money(labor)}</strong></div><div class="pf-card"><div class="pf-muted">Coût total</div><strong style="font-size:28px">${money(cost)}</strong></div><div class="pf-card"><div class="pf-muted">Marge journalière</div><strong class="${margin<0?"pf-bad":"pf-good"}" style="font-size:28px">${money(margin)}</strong><div>${revenue?((margin/revenue)*100).toFixed(1)+" %":"—"}</div></div></div>
  ${allocation.incompleteInterventions?`<div class="pf-card pf-warn">⚠️ ${allocation.incompleteInterventions} intervention(s) sans horaires complets ou sans équipe : la main-d’œuvre et la marge restent provisoires.</div>`:""}${missingRevenue?`<div class="pf-card pf-warn">⚠️ ${missingRevenue} OS travaillé(s) n'ont pas encore de constat validé : ils ne sont pas inclus dans le CA/marge.</div>`:""}${missingMaterialParameters?`<div class="pf-card pf-warn">⚠️ Pour ${missingMaterialParameters} OS, il manque le matériau, l’épaisseur, la densité ou le prix d’achat : le coût matière prévisionnel ne peut pas être calculé.</div>`:""}${missingMaterial?`<div class="pf-card pf-warn">ℹ️ ${missingMaterial} OS ont encore une consommation matière estimée : la marge est provisoire tant que la consommation réelle n'est pas saisie.</div>`:""}
  <div class="pf-card" style="overflow:auto"><h3 style="margin-top:0">Rentabilité par OS — ${esc(date)}</h3><table class="pf-table"><thead><tr><th>OS</th><th>Constat</th><th>CA HT</th><th>Matière</th><th>Main-d'œuvre</th><th>Coûts</th><th>Marge</th></tr></thead><tbody>${renderTable(rows)}</tbody></table></div>
  <div class="pf-card"><h3 style="margin-top:0">Méthode</h3><p class="pf-muted" style="margin:0">Le CA HT provient des constats validés des OS réalisés ce jour. Les coûts matière et main-d’œuvre incluent tous les OS travaillés, y compris ceux dont le constat attend encore la validation : leurs coûts ne sont donc pas masqués. Les consommations estimées, mixtes et les paramètres de prix manquants sont signalés. La main-d’œuvre est calculée à partir des horaires (amplitude moins 1 h de pause) puis répartie selon le temps chantier. Les frais de camion, carburant, matériel et autres frais restent à intégrer.</p></div>`;
 }catch(e){root.querySelector("#pf-content").innerHTML=`<div class="pf-card pf-bad">Impossible de charger la rentabilité : ${esc(e?.message||e)}</div>`;}
}
function close(){document.getElementById(ROOT)?.replaceChildren();}
function open(){styles();let root=document.getElementById(ROOT);if(!root){root=document.createElement("div");root.id=ROOT;document.body.appendChild(root);}render(today());}
function mount(){styles();if(document.getElementById(`${ROOT}-btn`))return;const b=document.createElement("button");b.id=`${ROOT}-btn`;b.textContent="💶 Rentabilité";b.onclick=open;document.body.appendChild(b);}
window.addEventListener("load",mount);setTimeout(mount,1200);setInterval(mount,3000);
