import "./planningTasksEnhancement";
import { supabase } from "./supabase";

const PANEL_ID = "setom-profitability-overlay";
const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const euro = (v) => `${num(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const tonnes = (v) => `${num(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t`;

function addStyle() {
  if (document.getElementById("setom-profitability-style")) return;
  const style = document.createElement("style");
  style.id = "setom-profitability-style";
  style.textContent = `
    #${PANEL_ID}-launcher{position:fixed;right:18px;bottom:18px;z-index:99990;border:0;border-radius:999px;padding:13px 17px;background:#102a56;color:#fff;font-weight:800;box-shadow:0 10px 30px rgba(16,42,86,.25);cursor:pointer}
    #${PANEL_ID}{position:fixed;inset:0;z-index:99991;background:rgba(10,24,45,.48);display:flex;align-items:flex-start;justify-content:center;padding:34px 18px;overflow:auto}
    #${PANEL_ID} .pr-box{width:min(1180px,100%);background:#f5f8fc;border-radius:22px;box-shadow:0 25px 70px rgba(0,0,0,.22);overflow:hidden}
    #${PANEL_ID} .pr-head{background:#102a56;color:#fff;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px}
    #${PANEL_ID} .pr-title{font-size:20px;font-weight:900}.pr-sub{font-size:12px;opacity:.78;margin-top:3px}
    #${PANEL_ID} .pr-close{border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}
    #${PANEL_ID} .pr-body{padding:18px}.pr-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
    #${PANEL_ID} select,#${PANEL_ID} button{font:inherit}.pr-toolbar select{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 12px}
    #${PANEL_ID} .pr-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px}
    #${PANEL_ID} .pr-card{background:#fff;border:1px solid #e0e7ef;border-radius:14px;padding:13px}.pr-label{font-size:11px;color:#667085}.pr-value{font-size:19px;font-weight:900;color:#102a56;margin-top:5px}.pr-positive{color:#087443}.pr-negative{color:#b42318}
    #${PANEL_ID} .pr-section{background:#fff;border:1px solid #e0e7ef;border-radius:14px;overflow:hidden;margin-top:12px}.pr-section h3{margin:0;padding:13px 15px;font-size:14px;color:#102a56;border-bottom:1px solid #edf1f5}
    #${PANEL_ID} table{width:100%;border-collapse:collapse;font-size:12px}#${PANEL_ID} th,#${PANEL_ID} td{padding:9px 10px;border-bottom:1px solid #edf1f5;text-align:left}#${PANEL_ID} th{background:#f8fafc;color:#667085;font-size:11px}#${PANEL_ID} td.num{text-align:right;font-variant-numeric:tabular-nums}
    #${PANEL_ID} .pr-empty{padding:20px;color:#667085;text-align:center}.pr-note{font-size:11px;color:#667085;margin-top:10px}
    @media(max-width:900px){#${PANEL_ID} .pr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#${PANEL_ID}{padding:10px}#${PANEL_ID} .pr-body{padding:10px}}
  `;
  document.head.appendChild(style);
}

async function loadProfitability() {
  const { data: orders, error: orderError } = await supabase.from("work_orders").select("id,os_number,status,planned_surface_m2,actual_road_surface_m2,actual_sidewalk_surface_m2,actual_other_surface_m2,creation_date").order("creation_date", { ascending: false });
  if (orderError) throw orderError;
  const ids = (orders || []).map((o) => o.id);
  if (!ids.length) return { rows: [], totals: {} };

  const [interventionResult, constatResult, consumptionResult, costResult, materialResult] = await Promise.all([
    supabase.from("interventions").select("id,work_order_id,planned_date,actual_date,status,planned_surface_m2,actual_surface_m2").in("work_order_id", ids),
    supabase.from("constats").select("id,work_order_id,total_amount,status,created_at,validated_at").in("work_order_id", ids).order("created_at", { ascending: false }),
    supabase.from("truck_material_consumptions").select("work_order_id,intervention_id,material_id,consumption_date,quantity,unit,estimated").in("work_order_id", ids),
    supabase.from("work_order_costs").select("work_order_id,intervention_id,cost_date,category,description,amount,quantity,unit").in("work_order_id", ids),
    supabase.from("materials").select("id,name,purchase_price_per_t,density_t_m3,default_thickness_cm").limit(500)
  ]);

  const interventions = interventionResult.data || [];
  const constats = constatResult.data || [];
  const consumptions = consumptionResult.data || [];
  const costs = costResult.data || [];
  const materials = materialResult.data || [];
  const materialById = new Map(materials.map((m) => [m.id, m]));
  const interventionByOS = new Map();
  interventions.forEach((i) => { if (!interventionByOS.has(i.work_order_id)) interventionByOS.set(i.work_order_id, i); });
  const latestConstatByOS = new Map();
  constats.forEach((c) => { if (!latestConstatByOS.has(c.work_order_id)) latestConstatByOS.set(c.work_order_id, c); });

  const rows = (orders || []).map((o) => {
    const i = interventionByOS.get(o.id);
    const c = latestConstatByOS.get(o.id);
    const osConsumptions = consumptions.filter((x) => x.work_order_id === o.id);
    const materialCost = osConsumptions.reduce((sum, x) => { const material = materialById.get(x.material_id); return sum + (num(x.quantity) * num(material?.purchase_price_per_t)); }, 0);
    const consumedTonnes = osConsumptions.reduce((sum, x) => sum + (String(x.unit || "").toLowerCase() === "t" ? num(x.quantity) : 0), 0);
    const osCosts = costs.filter((x) => x.work_order_id === o.id);
    const directOtherCost = osCosts.reduce((sum, x) => sum + num(x.amount), 0);
    const laborCost = osCosts.filter((x) => /main|salair|personnel|heures|heure/i.test(`${x.category || ""} ${x.description || ""}`)).reduce((sum, x) => sum + num(x.amount), 0);
    const ca = num(c?.total_amount);
    const directCost = materialCost + directOtherCost;
    const margin = ca - directCost;
    const marginPct = ca > 0 ? margin / ca * 100 : null;
    const date = i?.actual_date || i?.planned_date || c?.validated_at?.slice(0, 10) || o.creation_date?.slice(0, 10) || null;
    const actualSurface = num(o.actual_road_surface_m2) + num(o.actual_sidewalk_surface_m2) + num(o.actual_other_surface_m2);
    return { id: o.id, osNumber: o.os_number, status: o.status, date, plannedSurface: num(i?.planned_surface_m2 || o.planned_surface_m2), actualSurface: actualSurface || num(i?.actual_surface_m2), ca, materialCost, laborCost, directOtherCost, directCost, margin, marginPct, consumedTonnes, constatStatus: c?.status || "—" };
  });

  const totals = rows.reduce((a, r) => { a.ca += r.ca; a.materialCost += r.materialCost; a.laborCost += r.laborCost; a.directOtherCost += r.directOtherCost; a.directCost += r.directCost; a.margin += r.margin; a.tonnes += r.consumedTonnes; a.surface += r.actualSurface; return a; }, { ca: 0, materialCost: 0, laborCost: 0, directOtherCost: 0, directCost: 0, margin: 0, tonnes: 0, surface: 0 });
  totals.marginPct = totals.ca > 0 ? totals.margin / totals.ca * 100 : null;
  return { rows, totals };
}

function render(data, month) {
  addStyle();
  document.getElementById(PANEL_ID)?.remove();
  const overlay = document.createElement("div"); overlay.id = PANEL_ID;
  const months = [...new Set(data.rows.map((r) => r.date?.slice(0, 7)).filter(Boolean))].sort().reverse();
  const filtered = month === "all" ? data.rows : data.rows.filter((r) => r.date?.slice(0, 7) === month);
  const totals = filtered.reduce((a, r) => { a.ca += r.ca; a.material += r.materialCost; a.labor += r.laborCost; a.other += r.directOtherCost; a.cost += r.directCost; a.margin += r.margin; a.tonnes += r.consumedTonnes; a.surface += r.actualSurface; return a; }, { ca: 0, material: 0, labor: 0, other: 0, cost: 0, margin: 0, tonnes: 0, surface: 0 });
  totals.marginPct = totals.ca > 0 ? totals.margin / totals.ca * 100 : null;
  const days = new Map();
  filtered.forEach((r) => { const key = r.date || "Sans date"; const d = days.get(key) || { date: key, ca: 0, cost: 0, margin: 0, surface: 0, tonnes: 0, os: 0 }; d.ca += r.ca; d.cost += r.directCost; d.margin += r.margin; d.surface += r.actualSurface; d.tonnes += r.consumedTonnes; d.os++; days.set(key, d); });
  const dayRows = [...days.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const moneyClass = (v) => v >= 0 ? "pr-positive" : "pr-negative";
  overlay.innerHTML = `<div class="pr-box"><div class="pr-head"><div><div class="pr-title">Pilotage · Rentabilité</div><div class="pr-sub">CA, coûts directs, tonnage et marge par OS et par journée</div></div><button class="pr-close" id="pr-close">Fermer</button></div><div class="pr-body"><div class="pr-toolbar"><select id="pr-month"><option value="all">Toutes les périodes</option>${months.map((m) => `<option value="${m}">${new Date(`${m}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</option>`).join("")}</select><button class="pr-close" style="background:#edf3fb;color:#173a6b" id="pr-refresh">Actualiser</button></div><div class="pr-grid"><div class="pr-card"><div class="pr-label">Chiffre d'affaires</div><div class="pr-value">${euro(totals.ca)}</div></div><div class="pr-card"><div class="pr-label">Coût matériaux</div><div class="pr-value">${euro(totals.material)}</div></div><div class="pr-card"><div class="pr-label">Autres coûts directs</div><div class="pr-value">${euro(totals.other)}</div></div><div class="pr-card"><div class="pr-label">Coût direct total</div><div class="pr-value">${euro(totals.cost)}</div></div><div class="pr-card"><div class="pr-label">Marge brute</div><div class="pr-value ${moneyClass(totals.margin)}">${euro(totals.margin)}${totals.marginPct == null ? "" : ` · ${totals.marginPct.toFixed(1)} %`}</div></div></div><div class="pr-grid"><div class="pr-card"><div class="pr-label">Surface réalisée</div><div class="pr-value">${num(totals.surface).toFixed(1)} m²</div></div><div class="pr-card"><div class="pr-label">Tonnage consommé</div><div class="pr-value">${tonnes(totals.tonnes)}</div></div><div class="pr-card"><div class="pr-label">OS analysés</div><div class="pr-value">${filtered.length}</div></div><div class="pr-card"><div class="pr-label">CA moyen / OS</div><div class="pr-value">${euro(filtered.length ? totals.ca / filtered.length : 0)}</div></div><div class="pr-card"><div class="pr-label">Marge moyenne / OS</div><div class="pr-value ${moneyClass(totals.margin)}">${euro(filtered.length ? totals.margin / filtered.length : 0)}</div></div></div><div class="pr-section"><h3>Rentabilité par OS</h3>${filtered.length ? `<div style="overflow:auto"><table><thead><tr><th>OS</th><th>Date</th><th>Statut</th><th>Surface</th><th>Tonnage</th><th>CA</th><th>Matériaux</th><th>Coûts directs</th><th>Marge</th><th>%</th></tr></thead><tbody>${filtered.map((r) => `<tr><td><strong>OS-${String(r.osNumber).padStart(5, "0")}</strong></td><td>${r.date || "—"}</td><td>${r.status || "—"}</td><td class="num">${r.actualSurface.toFixed(1)} m²</td><td class="num">${r.consumedTonnes.toFixed(2)} t</td><td class="num">${euro(r.ca)}</td><td class="num">${euro(r.materialCost)}</td><td class="num">${euro(r.directCost)}</td><td class="num ${moneyClass(r.margin)}">${euro(r.margin)}</td><td class="num">${r.marginPct == null ? "—" : `${r.marginPct.toFixed(1)} %`}</td></tr>`).join("")}</tbody></table></div>` : `<div class="pr-empty">Aucune donnée de rentabilité sur cette période.</div>`}</div><div class="pr-section"><h3>Rentabilité par journée</h3>${dayRows.length ? `<div style="overflow:auto"><table><thead><tr><th>Journée</th><th>OS</th><th>Surface</th><th>Tonnage</th><th>CA</th><th>Coûts directs</th><th>Marge</th></tr></thead><tbody>${dayRows.map((d) => `<tr><td><strong>${d.date}</strong></td><td>${d.os}</td><td class="num">${d.surface.toFixed(1)} m²</td><td class="num">${d.tonnes.toFixed(2)} t</td><td class="num">${euro(d.ca)}</td><td class="num">${euro(d.cost)}</td><td class="num ${moneyClass(d.margin)}">${euro(d.margin)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="pr-empty">Aucune journée à afficher.</div>`}</div><div class="pr-note">Pour l'instant, la marge utilise uniquement les coûts directs enregistrés et le coût d'achat des matériaux consommés. Le coefficient de dépenses générales sera ajouté ultérieurement dans les paramètres, sans modifier ces données.</div></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#pr-close")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector("#pr-refresh")?.addEventListener("click", async () => { const btn = overlay.querySelector("#pr-refresh"); btn.disabled = true; try { const fresh = await loadProfitability(); render(fresh, overlay.querySelector("#pr-month")?.value || "all"); } finally { btn.disabled = false; } });
  overlay.querySelector("#pr-month")?.addEventListener("change", (e) => render(data, e.target.value));
}
async function openPilotage() { const old = document.getElementById(PANEL_ID); if (old) { old.remove(); return; } addStyle(); const launcher = document.getElementById(`${PANEL_ID}-launcher`); if (launcher) launcher.disabled = true; try { render(await loadProfitability(), "all"); } catch (error) { console.error("SETOM rentabilité :", error); alert(`Impossible de charger le pilotage rentabilité : ${error?.message || "erreur inconnue"}`); } finally { if (launcher) launcher.disabled = false; } }
function mountLauncher() { if (document.getElementById(`${PANEL_ID}-launcher`)) return; addStyle(); const button = document.createElement("button"); button.id = `${PANEL_ID}-launcher`; button.type = "button"; button.textContent = "📊 Rentabilité"; button.title = "Ouvrir le pilotage rentabilité"; button.addEventListener("click", openPilotage); document.body.appendChild(button); }
mountLauncher();
window.addEventListener("setom:planning-updated", mountLauncher);
