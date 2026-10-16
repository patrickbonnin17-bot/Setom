import { supabase } from "./supabase";

const ROOT_ID = "setom-daily-pilotage";
const STYLE_ID = "setom-daily-pilotage-style";
const money = (v) => `${Number(v || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const num = (v, d = 1) => Number(v || 0).toLocaleString("fr-FR", { maximumFractionDigits: d });
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID}{position:fixed;right:18px;bottom:18px;z-index:12000;font-family:inherit}
    #${ROOT_ID} .sp-btn{border:0;border-radius:999px;background:#0b3b66;color:#fff;padding:11px 16px;font-weight:800;box-shadow:0 8px 28px rgba(0,0,0,.2);cursor:pointer}
    #${ROOT_ID} .sp-panel{position:fixed;right:18px;bottom:72px;width:min(980px,calc(100vw - 36px));max-height:calc(100vh - 110px);overflow:auto;background:#f5f8fb;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.25);border:1px solid #d9e3ec;padding:18px}
    #${ROOT_ID} .sp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.sp-head h3{margin:0;color:#0b3b66}.sp-close{border:0;background:#fff;border-radius:10px;padding:8px 11px;cursor:pointer}
    #${ROOT_ID} .sp-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}.sp-toolbar input{padding:9px 10px;border:1px solid #cbd7e2;border-radius:9px;background:#fff}.sp-toolbar button{border:0;border-radius:9px;padding:9px 12px;background:#0b3b66;color:#fff;font-weight:700;cursor:pointer}
    #${ROOT_ID} .sp-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:14px}.sp-card{background:#fff;border:1px solid #e0e7ee;border-radius:13px;padding:12px}.sp-card span{display:block;color:#718096;font-size:12px}.sp-card strong{display:block;font-size:21px;margin-top:4px;color:#17324d}
    #${ROOT_ID} .sp-table{width:100%;border-collapse:collapse;background:#fff;border-radius:13px;overflow:hidden}.sp-table th,.sp-table td{padding:9px 10px;border-bottom:1px solid #edf1f5;text-align:left;font-size:13px}.sp-table th{background:#eef4f9;color:#466176}.sp-table td.num{text-align:right;font-variant-numeric:tabular-nums}.sp-good{color:#16804a;font-weight:800}.sp-bad{color:#c0392b;font-weight:800}.sp-muted{color:#718096;font-size:12px}.sp-loading{padding:20px;text-align:center;color:#718096}
    @media(max-width:700px){#${ROOT_ID}{right:10px;bottom:10px}#${ROOT_ID} .sp-panel{right:10px;bottom:62px;width:calc(100vw - 20px);padding:12px}.sp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-table{font-size:12px}.sp-table th:nth-child(5),.sp-table td:nth-child(5){display:none}}
  `;
  document.head.appendChild(style);
}

async function loadDay(date) {
  const panel = document.querySelector(`#${ROOT_ID} .sp-content`);
  if (!panel) return;
  panel.innerHTML = `<div class="sp-loading">Calcul de la journée…</div>`;
  const { data: interventions, error: iError } = await supabase
    .from("interventions")
    .select("id,work_order_id,team_id,planned_date,planned_order,status,planned_surface_m2,actual_surface_m2")
    .eq("planned_date", date)
    .order("planned_order", { ascending: true });
  if (iError) { panel.innerHTML = `<div class="sp-bad">${iError.message}</div>`; return; }

  const ids = [...new Set((interventions || []).map((x) => x.work_order_id).filter(Boolean))];
  if (!ids.length) { renderEmpty(panel, date); return; }

  const [{ data: orders }, { data: materials }, { data: constats }, { data: costs }, { data: consumptions }, { data: loads }, { data: teams }] = await Promise.all([
    supabase.from("work_orders").select("id,os_number,planned_surface_m2,actual_road_surface_m2,actual_sidewalk_surface_m2,actual_other_surface_m2,material_id,material_detail,status").in("id", ids),
    supabase.from("materials").select("id,name,density_t_m3,default_thickness_cm,purchase_price_per_t,active"),
    supabase.from("constats").select("work_order_id,total_amount,status").in("work_order_id", ids),
    supabase.from("work_order_costs").select("work_order_id,amount,category").in("work_order_id", ids),
    supabase.from("truck_material_consumptions").select("work_order_id,quantity,unit,estimated,source").in("work_order_id", ids),
    supabase.from("truck_daily_loads").select("material_id,loaded_quantity,unit,notes").eq("load_date", date),
    supabase.from("teams").select("id,name")
  ]);
  const orderById = new Map((orders || []).map((x) => [x.id, x]));
  const materialById = new Map((materials || []).map((x) => [x.id, x]));
  const teamById = new Map((teams || []).map((x) => [x.id, x.name]));
  const revenueById = new Map();
  for (const c of constats || []) revenueById.set(c.work_order_id, Math.max(Number(revenueById.get(c.work_order_id) || 0), Number(c.total_amount || 0)));
  const costById = new Map();
  for (const c of costs || []) costById.set(c.work_order_id, Number(costById.get(c.work_order_id) || 0) + Number(c.amount || 0));
  const consumptionById = new Map();
  for (const c of consumptions || []) if (String(c.unit || "").toLowerCase().includes("t")) consumptionById.set(c.work_order_id, Number(consumptionById.get(c.work_order_id) || 0) + Number(c.quantity || 0));

  let plannedSurface = 0, actualSurface = 0, estimatedTonnage = 0, consumedTonnage = 0, revenue = 0, directCosts = 0, materialCosts = 0;
  const rows = (interventions || []).map((i) => {
    const o = orderById.get(i.work_order_id) || {};
    const material = materialById.get(o.material_id);
    const ps = Number(i.planned_surface_m2 ?? o.planned_surface_m2 ?? 0);
    const as = Number(i.actual_surface_m2 ?? ((Number(o.actual_road_surface_m2 || 0) + Number(o.actual_sidewalk_surface_m2 || 0) + Number(o.actual_other_surface_m2 || 0)) || 0));
    const density = Number(material?.density_t_m3 || 0);
    const thickness = Number(material?.default_thickness_cm || 0) / 100;
    const estimated = ps * thickness * density;
    const consumed = Number(consumptionById.get(i.work_order_id) || 0);
    const rev = Number(revenueById.get(i.work_order_id) || 0);
    const extra = Number(costById.get(i.work_order_id) || 0);
    const matCost = consumed * Number(material?.purchase_price_per_t || 0);
    plannedSurface += ps; actualSurface += as; estimatedTonnage += estimated; consumedTonnage += consumed; revenue += rev; directCosts += extra; materialCosts += matCost;
    return { i, o, material, ps, as, estimated, consumed, rev, extra, matCost };
  });
  const totalCosts = directCosts + materialCosts;
  const margin = revenue - totalCosts;
  const loaded = (loads || []).reduce((s, x) => s + (String(x.unit || "").toLowerCase().includes("t") ? Number(x.loaded_quantity || 0) : 0), 0);
  const remaining = loaded - consumedTonnage;

  panel.innerHTML = `
    <div class="sp-grid">
      <div class="sp-card"><span>OS planifiés</span><strong>${rows.length}</strong></div>
      <div class="sp-card"><span>Surface prévue</span><strong>${num(plannedSurface)} m²</strong></div>
      <div class="sp-card"><span>Tonnage prévu</span><strong>${num(estimatedTonnage,2)} t</strong></div>
      <div class="sp-card"><span>Chargement déclaré</span><strong>${num(loaded,2)} t</strong></div>
      <div class="sp-card"><span>Consommé</span><strong>${num(consumedTonnage,2)} t</strong></div>
      <div class="sp-card"><span>Reste camion</span><strong class="${remaining < 0 ? "sp-bad" : "sp-good"}">${num(remaining,2)} t</strong></div>
      <div class="sp-card"><span>CA constaté</span><strong>${money(revenue)}</strong></div>
      <div class="sp-card"><span>Matériaux</span><strong>${money(materialCosts)}</strong></div>
      <div class="sp-card"><span>Autres coûts</span><strong>${money(directCosts)}</strong></div>
      <div class="sp-card"><span>Coût total</span><strong>${money(totalCosts)}</strong></div>
      <div class="sp-card"><span>Marge</span><strong class="${margin < 0 ? "sp-bad" : "sp-good"}">${money(margin)}</strong></div>
      <div class="sp-card"><span>Marge %</span><strong class="${margin < 0 ? "sp-bad" : "sp-good"}">${revenue ? num((margin / revenue) * 100,1) : "—"} %</strong></div>
    </div>
    <table class="sp-table"><thead><tr><th>Ordre</th><th>OS</th><th>Équipe</th><th>Surface</th><th>Tonnage</th><th>CA</th><th>Coûts</th><th>Marge</th></tr></thead><tbody>
      ${rows.map((r) => { const rowCost = r.extra + r.matCost; const rowMargin = r.rev - rowCost; return `<tr><td>${Number(r.i.planned_order || 0) || "—"}</td><td><strong>OS ${r.o.os_number ?? "—"}</strong><div class="sp-muted">${r.material?.name || r.o.material_detail || "Matériau non renseigné"}</div></td><td>${teamById.get(r.i.team_id) || "—"}</td><td class="num">${num(r.ps)} m²${r.as ? `<div class="sp-muted">réel ${num(r.as)} m²</div>` : ""}</td><td class="num">${num(r.consumed || r.estimated,2)} t${r.consumed ? `<div class="sp-muted">prévu ${num(r.estimated,2)} t</div>` : ""}</td><td class="num">${r.rev ? money(r.rev) : "—"}</td><td class="num">${money(rowCost)}</td><td class="num ${rowMargin < 0 ? "sp-bad" : "sp-good"}">${r.rev ? `${money(rowMargin)}<div class="sp-muted">${num((rowMargin/r.rev)*100,1)} %</div>` : "—"}</td></tr>`; }).join("")}
    </tbody></table>
    <div class="sp-muted" style="margin-top:10px">Le tonnage prévu est estimatif à partir de la surface, de l’épaisseur et de la densité du matériau. Les consommations réelles saisies dans Travaux prennent le relais lorsqu’elles existent. Le coefficient de dépenses générales n’est pas appliqué à ce stade.</div>
  `;
}

function renderEmpty(panel, date) { panel.innerHTML = `<div class="sp-card"><strong>Aucun OS planifié le ${new Date(date + "T12:00:00").toLocaleDateString("fr-FR")}.</strong><div class="sp-muted" style="margin-top:6px">Planifiez des interventions pour voir ici le tonnage, le chargement camion, les coûts et la rentabilité.</div></div>`; }

function mount() {
  if (document.getElementById(ROOT_ID)) return;
  injectStyle();
  const root = document.createElement("div"); root.id = ROOT_ID;
  root.innerHTML = `<button class="sp-btn">📊 Pilotage journée</button>`;
  document.body.appendChild(root);
  root.querySelector(".sp-btn").addEventListener("click", () => {
    if (root.querySelector(".sp-panel")) { root.querySelector(".sp-panel").remove(); return; }
    const date = isoToday();
    const panel = document.createElement("div"); panel.className = "sp-panel";
    panel.innerHTML = `<div class="sp-head"><h3>Pilotage de la journée</h3><button class="sp-close">Fermer</button></div><div class="sp-toolbar"><label>Date <input id="sp-date" type="date" value="${date}"></label><button id="sp-refresh">Actualiser</button></div><div class="sp-content"></div>`;
    root.appendChild(panel);
    panel.querySelector(".sp-close").onclick = () => panel.remove();
    const refresh = () => loadDay(panel.querySelector("#sp-date").value);
    panel.querySelector("#sp-date").addEventListener("change", refresh);
    panel.querySelector("#sp-refresh").onclick = refresh;
    refresh();
  });
}

mount();
