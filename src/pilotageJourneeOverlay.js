import { supabase } from "./supabase";

const ID = "setom-pilotage-journee";
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const money = (v) => `${n(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dateIso = (v) => String(v || "").slice(0, 10);
const tonnesUnit = (v) => String(v || "").toLowerCase().includes("t");

function currentDate() {
  const el = document.querySelector("input[type=date][data-setom-selected-date], .planning-date-input");
  return dateIso(el?.value) || new Date().toISOString().slice(0, 10);
}

async function loadDay(date) {
  const { data: interventions, error: iError } = await supabase.from("interventions")
    .select("id,work_order_id,planned_date,planned_order,team_id,planned_surface_m2,actual_surface_m2,status")
    .eq("planned_date", date).order("planned_order", { ascending: true });
  if (iError) throw iError;
  const ids = [...new Set((interventions || []).map(x => x.work_order_id).filter(Boolean))];
  if (!ids.length) return { rows: [], loads: [], consumptions: [], costs: [], constats: [], materials: [] };

  const [wo, loads, consumptions, costs, constats] = await Promise.all([
    supabase.from("work_orders").select("id,os_number,creation_date,address,city,planned_surface_m2,actual_road_surface_m2,actual_sidewalk_surface_m2,actual_other_surface_m2,material_id,material_detail,status").in("id", ids),
    supabase.from("truck_daily_loads").select("id,material_id,loaded_quantity,unit").eq("load_date", date),
    supabase.from("truck_material_consumptions").select("id,work_order_id,intervention_id,material_id,quantity,unit,estimated,consumption_date").eq("consumption_date", date).in("work_order_id", ids),
    supabase.from("work_order_costs").select("work_order_id,amount,category,description").in("work_order_id", ids).eq("cost_date", date),
    supabase.from("constats").select("work_order_id,total_amount,status").in("work_order_id", ids)
  ]);
  if (wo.error) throw wo.error;
  if (loads.error) throw loads.error;
  if (consumptions.error) throw consumptions.error;
  if (costs.error) throw costs.error;
  if (constats.error) throw constats.error;

  const materialIds = [...new Set([
    ...(wo.data || []).map(x => x.material_id),
    ...(loads.data || []).map(x => x.material_id),
    ...(consumptions.data || []).map(x => x.material_id)
  ].filter(Boolean))];
  let materials = [];
  if (materialIds.length) {
    const r = await supabase.from("materials").select("id,name,density_t_m3,default_thickness_cm,purchase_price_per_t").in("id", materialIds);
    if (r.error) throw r.error;
    materials = r.data || [];
  }

  const mat = new Map(materials.map(x => [x.id, x]));
  const woMap = new Map((wo.data || []).map(x => [x.id, x]));
  const revenueById = new Map();
  for (const c of constats.data || []) {
    revenueById.set(c.work_order_id, Math.max(n(revenueById.get(c.work_order_id)), n(c.total_amount)));
  }
  const costById = new Map();
  for (const c of costs.data || []) costById.set(c.work_order_id, n(costById.get(c.work_order_id)) + n(c.amount));
  const rows = (interventions || []).map((i, index) => {
    const o = woMap.get(i.work_order_id) || {};
    const material = mat.get(i.material_id || o.material_id) || null;
    const plannedSurface = n(i.planned_surface_m2 || o.planned_surface_m2);
    const actualSurface = n(i.actual_surface_m2) || (
      n(o.actual_road_surface_m2) + n(o.actual_sidewalk_surface_m2) + n(o.actual_other_surface_m2)
    );
    const surface = actualSurface || plannedSurface;
    const tonnes = material && n(material.density_t_m3) && n(material.default_thickness_cm)
      ? surface * n(material.density_t_m3) * n(material.default_thickness_cm) / 100
      : 0;
    const materialId = i.material_id || o.material_id || null;
    const consumption = (consumptions.data || [])
      .filter(c => c.work_order_id === i.work_order_id && tonnesUnit(c.unit))
      .reduce((s, c) => s + n(c.quantity), 0);
    const revenue = n(revenueById.get(i.work_order_id));
    const extraCosts = n(costById.get(i.work_order_id));
    const usedTonnes = consumption > 0 ? consumption : tonnes;
    const materialCost = usedTonnes * n(material?.purchase_price_per_t);
    const totalCost = materialCost + extraCosts;
    return { ...i, ...o, material, materialId, plannedSurface, actualSurface, tonnes, consumption, usedTonnes, revenue, extraCosts, materialCost, totalCost, margin: revenue - totalCost, order: n(i.planned_order) || index + 1 };
  });
  return { rows, loads: loads.data || [], consumptions: consumptions.data || [], costs: costs.data || [], constats: constats.data || [], materials };
}

function removeExisting() { document.getElementById(ID)?.remove(); }
function style() {
  if (document.getElementById(`${ID}-style`)) return;
  const s = document.createElement("style"); s.id = `${ID}-style`; s.textContent = `
    #${ID}{margin:16px 0;padding:16px;border:1px solid #dce5f1;border-radius:18px;background:linear-gradient(135deg,#f8fbff,#fff);box-shadow:0 8px 26px rgba(16,42,86,.07);font-family:inherit}
    #${ID} .pj-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}.pj-title{font-size:18px;font-weight:850;color:#102a56}.pj-sub{font-size:12px;color:#667085;margin-top:3px}
    #${ID} .pj-kpis{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px}.pj-kpi{background:#fff;border:1px solid #e4eaf2;border-radius:12px;padding:10px}.pj-label{font-size:10px;color:#667085}.pj-val{font-size:16px;font-weight:850;color:#102a56;margin-top:4px}.pj-val.good{color:#087443}.pj-val.warn{color:#b54708}.pj-val.bad{color:#c0392b}
    #${ID} .pj-truck{margin-top:12px;padding:12px;border-radius:14px;background:#102a56;color:#fff}.pj-truckline{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:13px}.pj-truck strong{font-size:18px}.pj-bar{height:9px;background:rgba(255,255,255,.2);border-radius:99px;overflow:hidden;margin-top:9px}.pj-fill{height:100%;background:#4ade80;border-radius:99px}
    #${ID} .pj-table{margin-top:12px;overflow:auto}#${ID} table{width:100%;border-collapse:collapse;min-width:1200px}#${ID} th,#${ID} td{padding:8px;border-bottom:1px solid #edf1f6;text-align:left;font-size:12px}#${ID} th{color:#667085;font-weight:700}#${ID} td strong{color:#102a56}.pj-rem{font-weight:850}.pj-pos{width:30px;text-align:center!important}.pj-empty{padding:18px;text-align:center;color:#667085;background:#fff;border:1px dashed #d7e0eb;border-radius:12px}.pj-good{color:#087443;font-weight:800}.pj-bad{color:#c0392b;font-weight:800}.pj-num{text-align:right;font-variant-numeric:tabular-nums}
    @media(max-width:1250px){#${ID} .pj-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:650px){#${ID}{padding:12px}#${ID} .pj-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.pj-title{font-size:16px}}
  `; document.head.appendChild(s);
}

function materialTotals(ctx) {
  const ids = new Set([
    ...(ctx.loads || []).map(x => x.material_id).filter(Boolean),
    ...(ctx.rows || []).map(x => x.materialId).filter(Boolean),
    ...(ctx.consumptions || []).map(x => x.material_id).filter(Boolean)
  ]);
  return [...ids].map(materialId => {
    const loaded = (ctx.loads || []).filter(x => x.material_id === materialId && tonnesUnit(x.unit)).reduce((s,x)=>s+n(x.loaded_quantity),0);
    const consumed = (ctx.consumptions || []).filter(x => x.material_id === materialId && tonnesUnit(x.unit)).reduce((s,x)=>s+n(x.quantity),0);
    const planned = (ctx.rows || []).filter(x => x.materialId === materialId).reduce((s,x)=>s+x.tonnes,0);
    const material = (ctx.materials || []).find(x => x.id === materialId);
    return { materialId, name: material?.name || "Matériau", loaded, consumed, planned, remaining: Math.max(0, loaded - consumed) };
  });
}

async function render(date = currentDate()) {
  style();
  const host = document.querySelector(".planning-overlay, .planner-overlay, [data-setom-planning], .planning-container");
  if (!host) return;
  removeExisting();
  const box = document.createElement("section"); box.id = ID; host.prepend(box);
  box.innerHTML = `<div class="pj-head"><div><div class="pj-title">📊 Pilotage de la journée</div><div class="pj-sub">Planning → surfaces → tonnage → camion → CA → coûts → rentabilité</div></div><span class="pj-sub">${new Date(date + "T12:00:00").toLocaleDateString("fr-FR", { weekday:"long", day:"2-digit", month:"long" })}</span></div><div class="pj-empty">Chargement des données…</div>`;
  try {
    const ctx = await loadDay(date);
    if (!ctx.rows.length) { box.querySelector(".pj-empty").textContent = "Aucun OS planifié pour cette journée."; return; }
    const totalSurface = ctx.rows.reduce((s,r)=>s+(r.actualSurface||r.plannedSurface),0);
    const totalTonnes = ctx.rows.reduce((s,r)=>s+r.tonnes,0);
    const loaded = ctx.loads.reduce((s,r)=>s+(tonnesUnit(r.unit)?n(r.loaded_quantity):0),0);
    const consumed = ctx.consumptions.reduce((s,r)=>s+(tonnesUnit(r.unit)?n(r.quantity):0),0);
    const remaining = Math.max(0, loaded-consumed);
    const revenue = ctx.rows.reduce((s,r)=>s+r.revenue,0);
    const materialCost = ctx.rows.reduce((s,r)=>s+r.materialCost,0);
    const complementary = ctx.rows.reduce((s,r)=>s+r.extraCosts,0);
    const totalCosts = materialCost + complementary;
    const margin = revenue - totalCosts;
    const marginPct = revenue > 0 ? margin / revenue * 100 : null;
    const usedPct = loaded > 0 ? Math.min(100, Math.max(0, consumed/loaded*100)) : 0;
    const materials = materialTotals(ctx);
    const rows = ctx.rows;
    box.innerHTML = `<div class="pj-head"><div><div class="pj-title">📊 Pilotage de la journée</div><div class="pj-sub">${ctx.rows.length} OS · CA des constats · consommation réelle prioritaire · suivi par matériau</div></div><button id="pj-refresh" style="border:0;border-radius:9px;padding:8px 12px;background:#0759d6;color:#fff;font-weight:700;cursor:pointer">Actualiser</button></div>
      <div class="pj-kpis">
        <div class="pj-kpi"><div class="pj-label">OS</div><div class="pj-val">${ctx.rows.length}</div></div>
        <div class="pj-kpi"><div class="pj-label">Surface</div><div class="pj-val">${totalSurface.toFixed(1)} m²</div></div>
        <div class="pj-kpi"><div class="pj-label">Tonnage estimé</div><div class="pj-val">${totalTonnes.toFixed(2)} t</div></div>
        <div class="pj-kpi"><div class="pj-label">Chargé</div><div class="pj-val">${loaded.toFixed(2)} t</div></div>
        <div class="pj-kpi"><div class="pj-label">Consommé</div><div class="pj-val">${consumed.toFixed(2)} t</div></div>
        <div class="pj-kpi"><div class="pj-label">Reste camion</div><div class="pj-val ${remaining<0.5?'warn':'good'}">${remaining.toFixed(2)} t</div></div>
        <div class="pj-kpi"><div class="pj-label">CA constaté</div><div class="pj-val">${money(revenue)}</div></div>
        <div class="pj-kpi"><div class="pj-label">Marge</div><div class="pj-val ${margin<0?'bad':'good'}">${money(margin)}${marginPct===null?'':` · ${marginPct.toFixed(1)} %`}</div></div>
      </div>
      <div class="pj-truck"><div class="pj-truckline"><span>🚚 Suivi du chargement</span><strong>${remaining.toFixed(2)} t restantes</strong></div><div class="pj-bar"><div class="pj-fill" style="width:${usedPct}%"></div></div><div class="pj-truckline" style="margin-top:6px;font-size:11px;opacity:.82"><span>${consumed.toFixed(2)} t consommées</span><span>${loaded.toFixed(2)} t chargées</span></div></div>
      <div class="pj-table"><table><thead><tr><th class="pj-pos">#</th><th>OS</th><th>Adresse</th><th>Matériau</th><th>Surface</th><th>Tonnage prévu</th><th>Consommé</th><th>Reste matériau</th><th>CA</th><th>Coût</th><th>Marge</th></tr></thead><tbody>${rows.map(r=>{
        const materialTotal = materials.find(m=>m.materialId===r.materialId);
        const materialRemaining = materialTotal ? materialTotal.remaining : 0;
        const marginClass = r.margin < 0 ? "pj-bad" : "pj-good";
        return `<tr><td class="pj-pos"><strong>${r.order}</strong></td><td><strong>OS-${String(r.os_number).padStart(5,"0")}</strong></td><td>${r.address||""}${r.city?` · ${r.city}`:""}</td><td>${r.material?.name||r.material_detail||"—"}</td><td class="pj-num">${(r.actualSurface||r.plannedSurface).toFixed(1)} m²</td><td class="pj-num">${r.tonnes.toFixed(2)} t</td><td class="pj-num">${r.consumption>0?r.consumption.toFixed(2):"—"} t</td><td class="pj-num pj-rem">${materialRemaining.toFixed(2)} t</td><td class="pj-num">${r.revenue?money(r.revenue):"—"}</td><td class="pj-num">${money(r.totalCost)}</td><td class="pj-num ${marginClass}">${r.revenue?`${money(r.margin)}${r.revenue?` · ${(r.margin/r.revenue*100).toFixed(1)} %`:""}`:"—"}</td></tr>`;
      }).join("")}</tbody></table></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">${materials.map(m=>`<div style="padding:8px 10px;background:#fff;border:1px solid #e4eaf2;border-radius:10px;font-size:12px"><strong>${m.name}</strong> · chargé ${m.loaded.toFixed(2)} t · consommé ${m.consumed.toFixed(2)} t · reste <strong>${m.remaining.toFixed(2)} t</strong></div>`).join("")}</div>
      <div class="pj-sub" style="margin-top:10px">Coûts = matériau au tonnage réel lorsqu’une consommation existe, sinon estimation + coûts complémentaires saisis sur l’OS. Le coût de main-d’œuvre et le coefficient de dépenses générales restent à intégrer/configurer ; aucun coefficient n’est appliqué automatiquement.</div>`;
    box.querySelector("#pj-refresh")?.addEventListener("click",()=>render(date));
  } catch(e) { box.querySelector(".pj-empty").textContent = `Erreur de chargement : ${e?.message||"erreur inconnue"}`; }
}

let timer;
function schedule(){ clearTimeout(timer); timer=setTimeout(()=>render(),250); }
const observer=new MutationObserver(schedule); observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener("setom:planning-updated",schedule);
window.addEventListener("setom:pilotage-date-changed",e=>render(e.detail?.date||currentDate()));
render();
