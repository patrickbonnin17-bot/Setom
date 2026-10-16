import { supabase } from "./supabase";

const ROOT = "setom-materials-finance-widget";
const STYLE = `${ROOT}-style`;
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const money = (v) => `${n(v).toFixed(2)} €`;
const esc = (v) => String(v ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

function styles(){
 if(document.getElementById(STYLE)) return;
 const s=document.createElement("style"); s.id=STYLE; s.textContent=`
 #${ROOT}-btn{position:fixed;right:365px;bottom:18px;z-index:99989;border:0;border-radius:999px;padding:12px 16px;background:#0f766e;color:#fff;font-weight:800;box-shadow:0 8px 26px rgba(0,0,0,.2);cursor:pointer}
 #${ROOT}-panel{position:fixed;inset:14px;z-index:99990;background:#f8fafc;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.3);overflow:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17202a}
 #${ROOT}-panel .mf-head{position:sticky;top:0;background:#fff;border-bottom:1px solid #e4e7ec;padding:15px 18px;display:flex;justify-content:space-between;align-items:center;z-index:2}
 #${ROOT}-panel .mf-body{max-width:1300px;margin:auto;padding:18px}.mf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}.mf-card{background:#fff;border:1px solid #e4e7ec;border-radius:14px;padding:14px;margin-bottom:12px}.mf-table{width:100%;border-collapse:collapse;min-width:900px}.mf-table th,.mf-table td{padding:9px;border-bottom:1px solid #edf0f4;text-align:left;font-size:13px}.mf-input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #d0d5dd;border-radius:8px}.mf-btn{border:1px solid #d0d5dd;border-radius:8px;padding:8px 11px;background:#fff;font-weight:700;cursor:pointer}.mf-primary{background:#175cd3;color:#fff;border-color:#175cd3}.mf-good{color:#027a48;font-weight:800}.mf-bad{color:#b42318;font-weight:800}.mf-muted{color:#667085;font-size:12px}.mf-warn{color:#b54708;font-weight:800}.mf-kpi{font-size:28px;font-weight:800}.mf-pill{display:inline-block;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800;background:#eef2f6;color:#475467}.mf-pill-real{background:#ecfdf3;color:#027a48}.mf-pill-est{background:#fff7ed;color:#b54708}
 @media(max-width:700px){#${ROOT}-panel{inset:0;border-radius:0}#${ROOT}-btn{right:12px;bottom:130px}.mf-body{padding:12px}}
 `; document.head.appendChild(s);
}

async function load(date){
 const [o,i,m,l,c] = await Promise.all([
  supabase.from("work_orders").select("id,os_number,status,address,city,material_detail,planned_surface_m2,material_id").in("status",["Nouveau OS","Planifié","Travaux réalisés","À vérifier","Validé","Réserve","Payé"]),
  supabase.from("interventions").select("id,work_order_id,planned_date"),
  supabase.from("materials").select("id,name,category,density_t_m3,default_thickness_cm,purchase_price_per_t,active").order("sort_order",{ascending:true}),
  supabase.from("truck_material_consumptions").select("work_order_id,material_id,consumption_date,quantity,estimated").eq("consumption_date",date),
  supabase.from("truck_daily_loads").select("material_id,loaded_quantity").eq("load_date",date)
 ]);
 for(const r of [o,i,m,l,c]) if(r.error) throw r.error;
 const byOS=new Map((i.data||[]).map(x=>[x.work_order_id,x]));
 return {orders:(o.data||[]).filter(x=>byOS.get(x.id)?.planned_date===date), materials:m.data||[], consumptions:l.data||[], loads:c.data||[]};
}
function materialFor(order,materials){
 const direct=materials.find(m=>m.id===order.material_id); if(direct) return direct;
 const t=String(order.material_detail||"").toLowerCase();
 return materials.find(m=>{const a=String(m.name||"").toLowerCase(),b=String(m.category||"").toLowerCase();return (a&&t.includes(a))||(b&&t.includes(b));})||null;
}
function calc(data){
 const actual=new Map(data.consumptions.map(x=>[`${x.work_order_id}:${x.material_id}`,n(x.quantity)]));
 return data.orders.map(o=>{const m=materialFor(o,data.materials);const surface=n(o.planned_surface_m2);const th=n(m?.default_thickness_cm);const den=n(m?.density_t_m3);const volume=surface>0&&th>0?surface*th/100:0;const estimated=volume*den;const key=m?`${o.id}:${m.id}`:"";const actualQty=key&&actual.has(key)?actual.get(key):null;const used=actualQty==null?estimated:actualQty;const cost=used*n(m?.purchase_price_per_t);return {o,m,surface,th,den,volume,estimated,actualQty,used,cost};});
}
async function saveActual(row,value,date){
 if(!row?.m){alert("Aucun matériau n'est paramétré pour cet OS.");return;}
 if(String(value??"").trim()===""){alert("Saisissez la consommation réelle en tonnes avant d'enregistrer.");return;}
 const qty=n(value); if(qty<0){alert("La consommation doit être positive ou nulle.");return;}
 const {data:u}=await supabase.auth.getUser();
 const {error}=await supabase.from("truck_material_consumptions").upsert({work_order_id:row.o.id,intervention_id:null,material_id:row.m.id,consumption_date:date,quantity:qty,unit:"t",estimated:false,source:"SETOM - saisie terrain",created_by:u?.user?.id||null},{onConflict:"work_order_id,material_id,consumption_date"});
 if(error) alert("Impossible d'enregistrer la consommation : "+error.message); else render(date);
}
async function saveLoad(materialId,value,date){
 const qty=n(value); if(qty<0){alert("Le chargement doit être positif ou nul.");return;}
 const {data:u}=await supabase.auth.getUser();
 const payload={load_date:date,material_id:materialId,loaded_quantity:qty,unit:"t",created_by:u?.user?.id||null,updated_at:new Date().toISOString()};
 const {data:existing,error:lookupError}=await supabase.from("truck_daily_loads").select("id").eq("load_date",date).eq("material_id",materialId).order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(lookupError){alert("Impossible de vérifier le chargement existant : "+lookupError.message);return;}
 const result=existing?.id ? await supabase.from("truck_daily_loads").update(payload).eq("id",existing.id) : await supabase.from("truck_daily_loads").insert(payload);
 if(result.error) alert("Impossible d'enregistrer le chargement : "+result.error.message); else render(date);
}

async function render(date){
 const root=document.getElementById(ROOT); if(!root)return;
 root.innerHTML=`<div id="${ROOT}-panel"><div class="mf-head"><div><strong style="font-size:19px">📊 Matériaux, stock & coûts</strong><div class="mf-muted">Prévision → chargement → consommation réelle → reste camion</div></div><button id="mf-close" class="mf-btn">Fermer</button></div><div class="mf-body"><div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:14px"><div><label class="mf-muted">Journée</label><input id="mf-date" class="mf-input" type="date" value="${esc(date)}"></div><button id="mf-refresh" class="mf-btn">↻ Actualiser</button></div><div id="mf-content">Chargement…</div></div></div>`;
 root.querySelector("#mf-close").onclick=close; root.querySelector("#mf-date").onchange=e=>render(e.target.value); root.querySelector("#mf-refresh").onclick=()=>render(root.querySelector("#mf-date").value);
 const content=root.querySelector("#mf-content");
 try{
  const data=await load(date), rows=calc(data);
  const totalForecast=rows.reduce((s,r)=>s+r.estimated,0), totalUsed=rows.reduce((s,r)=>s+r.used,0), totalCost=rows.reduce((s,r)=>s+r.cost,0);
  const byMat={}; rows.forEach(r=>{if(!r.m)return;const a=byMat[r.m.id] ||= {m:r.m,forecast:0,used:0,cost:0,realCount:0,totalCount:0};a.forecast+=r.estimated;a.used+=r.used;a.cost+=r.cost;a.totalCount++;if(r.actualQty!=null)a.realCount++;});
  const materialsSummary=Object.values(byMat).map(a=>{const load=data.loads.find(x=>x.material_id===a.m.id);const loaded=n(load?.loaded_quantity);return {...a,loaded,remaining:loaded-a.used};});
  const totalLoaded=materialsSummary.reduce((s,a)=>s+a.loaded,0), totalRemaining=materialsSummary.reduce((s,a)=>s+a.remaining,0), missingLoads=materialsSummary.filter(a=>a.loaded<=0&&a.used>0).length, missingPrices=materialsSummary.filter(a=>a.m.purchase_price_per_t==null||n(a.m.purchase_price_per_t)<=0).length;
  content.innerHTML=`<div class="mf-grid"><div class="mf-card"><div class="mf-muted">OS prévus</div><div class="mf-kpi">${rows.length}</div></div><div class="mf-card"><div class="mf-muted">Tonnage prévisionnel</div><div class="mf-kpi">${totalForecast.toFixed(2)} t</div></div><div class="mf-card"><div class="mf-muted">Tonnage retenu</div><div class="mf-kpi">${totalUsed.toFixed(2)} t</div><div class="mf-muted">${rows.filter(r=>r.actualQty!=null).length}/${rows.length} OS avec réel saisi</div></div><div class="mf-card"><div class="mf-muted">Chargement camion</div><div class="mf-kpi">${totalLoaded.toFixed(2)} t</div></div><div class="mf-card"><div class="mf-muted">Reste camion estimé</div><div class="mf-kpi ${totalRemaining<0?"mf-bad":"mf-good"}">${totalRemaining.toFixed(2)} t</div></div><div class="mf-card"><div class="mf-muted">Coût matière</div><div class="mf-kpi">${money(totalCost)}</div></div></div>
  ${(missingLoads||missingPrices)?`<div class="mf-card"><strong>⚠️ Points à compléter</strong><div style="margin-top:8px">${missingLoads?`<div class="mf-warn">• ${missingLoads} matériau(x) utilisé(s) sans chargement camion renseigné.</div>`:""}${missingPrices?`<div class="mf-warn">• ${missingPrices} matériau(x) sans prix d'achat : le tonnage est calculé, mais son coût reste à 0 €.</div>`:""}</div></div>`:""}
  <div class="mf-card" style="overflow:auto"><h3 style="margin-top:0">OS de la journée</h3><table class="mf-table"><thead><tr><th>OS</th><th>Matériau</th><th>Surface</th><th>Épaisseur</th><th>Prévision</th><th>Réel</th><th>Écart</th><th>Coût retenu</th><th></th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td><strong>${esc(r.o.os_number)}</strong></td><td>${esc(r.m?.name||r.o.material_detail||"⚠️ non paramétré")}</td><td>${r.surface.toFixed(2)} m²</td><td>${r.th?r.th+" cm":"⚠️"}</td><td>${r.estimated?r.estimated.toFixed(2)+" t":"—"}</td><td><input id="mf-actual-${r.o.id}" class="mf-input" type="number" min="0" step="0.01" value="${r.actualQty==null?"":r.actualQty}" placeholder="${r.estimated.toFixed(2)}"></td><td>${r.actualQty==null?`<span class="mf-pill mf-pill-est">estimé</span>`:`<span class="mf-pill mf-pill-real">${(r.actualQty-r.estimated>=0?"+":"")+(r.actualQty-r.estimated).toFixed(2)} t</span>`}</td><td>${r.m?.purchase_price_per_t>0?money(r.cost):`<span class="mf-warn">prix manquant</span>`}</td><td>${r.m?`<button class="mf-btn mf-primary" data-save="${r.o.id}">Enregistrer</button>`:""}</td></tr>`).join(""):`<tr><td colspan="9">Aucun OS planifié.</td></tr>`}</tbody></table></div>
  <div class="mf-card"><h3 style="margin-top:0">🚛 Stock camion — vision journée</h3><div class="mf-grid">${materialsSummary.map(a=>`<div class="mf-card"><strong>${esc(a.m.name)}</strong><div class="mf-muted" style="margin:6px 0">Prévu : ${a.forecast.toFixed(2)} t · Retenu : ${a.used.toFixed(2)} t</div><label class="mf-muted">Chargé (t)</label><input id="mf-load-${a.m.id}" class="mf-input" type="number" min="0" step="0.01" value="${a.loaded||""}"><button class="mf-btn" style="margin-top:7px" data-load="${a.m.id}">💾 Enregistrer</button><div class="${a.remaining<0?"mf-bad":"mf-good"}" style="margin-top:8px">${a.loaded<=0&&a.used>0?`⚠️ Chargement non renseigné`:(a.remaining<0?`⚠️ Manque ${Math.abs(a.remaining).toFixed(2)} t`:`Reste estimé : ${a.remaining.toFixed(2)} t`)}</div></div>`).join("")||"Aucun matériau utilisé sur la journée."}</div></div>
  <div class="mf-card"><h3 style="margin-top:0">💶 Coût matière & écart</h3><div style="overflow:auto"><table class="mf-table"><thead><tr><th>Matériau</th><th>Prévision</th><th>Retenu</th><th>Écart</th><th>Chargé</th><th>Reste</th><th>Prix achat</th><th>Coût</th></tr></thead><tbody>${materialsSummary.map(a=>`<tr><td>${esc(a.m.name)}</td><td>${a.forecast.toFixed(2)} t</td><td>${a.used.toFixed(2)} t</td><td>${(a.used-a.forecast>=0?"+":"")+(a.used-a.forecast).toFixed(2)} t</td><td>${a.loaded.toFixed(2)} t</td><td class="${a.remaining<0?"mf-bad":"mf-good"}">${a.remaining.toFixed(2)} t</td><td>${a.m.purchase_price_per_t>0?money(a.m.purchase_price_per_t)+"/t":"prix manquant"}</td><td><strong>${money(a.cost)}</strong></td></tr>`).join("")}</tbody></table></div><p class="mf-muted" style="margin-bottom:0">Le tonnage prévisionnel est calculé à partir de la surface × épaisseur × masse volumique. Dès qu'un réel est saisi sur un OS, celui-ci remplace l'estimation pour le stock et le coût. Le reste camion = chargement renseigné − consommation retenue.</p></div>`;
  root.querySelectorAll("[data-save]").forEach(b=>b.onclick=()=>{const id=b.dataset.save;const row=rows.find(x=>x.o.id===id);saveActual(row,root.querySelector(`#mf-actual-${id}`)?.value,date);});
  root.querySelectorAll("[data-load]").forEach(b=>b.onclick=()=>saveLoad(b.dataset.load,root.querySelector(`#mf-load-${b.dataset.load}`)?.value,date));
 }catch(e){content.innerHTML=`<div class="mf-card mf-bad">Impossible de charger les données : ${esc(e?.message||e)}</div>`;}
}
function close(){document.getElementById(ROOT)?.replaceChildren();}
function open(){styles();let root=document.getElementById(ROOT);if(!root){root=document.createElement("div");root.id=ROOT;document.body.appendChild(root);}render(today());}
function mount(){styles();if(document.getElementById(`${ROOT}-btn`))return;const b=document.createElement("button");b.id=`${ROOT}-btn`;b.textContent="📊 Coûts & stock";b.onclick=open;document.body.appendChild(b);}
window.addEventListener("load",mount);setTimeout(mount,1200);setInterval(mount,3000);
