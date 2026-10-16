import { supabase } from "./supabase";

const ROOT = "setom-pilotage-journee";
const COST_PREFIX = "Équipe ";
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const money = (v) => `${n(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dateOf = () => String(document.querySelector("input[type=date][data-setom-selected-date], .planning-date-input")?.value || new Date().toISOString().slice(0,10)).slice(0,10);

async function load(date) {
  const ir = await supabase.from("interventions").select("id,work_order_id,planned_order").eq("planned_date", date).order("planned_order", { ascending:true });
  if (ir.error) throw ir.error;
  const ids = [...new Set((ir.data || []).map(x => x.work_order_id).filter(Boolean))];
  if (!ids.length) return { byId:new Map(), revenue:new Map(), teamTotal:0, otherTotal:0 };
  const [cr, wr] = await Promise.all([
    supabase.from("work_order_costs").select("work_order_id,amount,description,category").eq("cost_date", date).in("work_order_id", ids),
    supabase.from("constats").select("work_order_id,total_amount").in("work_order_id", ids)
  ]);
  if (cr.error) throw cr.error;
  if (wr.error) throw wr.error;
  const byId = new Map();
  let teamTotal = 0, otherTotal = 0;
  for (const c of cr.data || []) {
    const amount = n(c.amount);
    const isTeam = String(c.description || "").startsWith(COST_PREFIX);
    const row = byId.get(c.work_order_id) || { team:0, other:0 };
    if (isTeam) { row.team += amount; teamTotal += amount; }
    else { row.other += amount; otherTotal += amount; }
    byId.set(c.work_order_id, row);
  }
  const revenue = new Map();
  for (const c of wr.data || []) revenue.set(c.work_order_id, Math.max(n(revenue.get(c.work_order_id)), n(c.total_amount)));
  return { byId, revenue, teamTotal, otherTotal };
}

function readDailyRate(date) {
  try {
    const d = JSON.parse(localStorage.getItem(`setom-daily-team-costs-v1:${date}`) || "null");
    if (!d) return null;
    const total = ["personnel_amount","vehicles_amount","materials_amount","equipment_amount","fuel_amount","other_amount"].reduce((s,k)=>s+n(d[k]),0);
    const hours = n(d.hours);
    return hours > 0 ? { total, hours, rate: total / hours } : null;
  } catch { return null; }
}

async function patch() {
  const box = document.getElementById(ROOT);
  const table = box?.querySelector(".pj-table table");
  if (!table) return;
  const date = dateOf();
  const ctx = await load(date);
  const trs = [...table.querySelectorAll("tbody tr")];
  for (const tr of trs) {
    const osCell = tr.children[1];
    const m = String(osCell?.textContent || "").match(/OS-(\d+)/);
    if (!m) continue;
    const os = Number(m[1]);
    if (!Number.isFinite(os)) continue;
    const workOrder = [...ctx.byId.keys()].find(id => false);
    const rowData = [...ctx.revenue.entries()].find(([id]) => false);
    void workOrder; void rowData;
  }

  const wo = await supabase.from("work_orders").select("id,os_number").in("id", [...ctx.byId.keys()]);
  if (wo.error) throw wo.error;
  const osToId = new Map((wo.data || []).map(x => [String(Number(x.os_number)), x.id]));
  let displayedMargin = 0, displayedRevenue = 0;
  for (const tr of trs) {
    const m = String(tr.children[1]?.textContent || "").match(/OS-(\d+)/);
    if (!m) continue;
    const id = osToId.get(String(Number(m[1])));
    if (!id) continue;
    const c = ctx.byId.get(id) || { team:0, other:0 };
    const revenue = n(ctx.revenue.get(id));
    const totalCost = c.team + c.other;
    const margin = revenue - totalCost;
    if (tr.children[9]) tr.children[9].innerHTML = `<strong>${money(totalCost)}</strong><div style="font-size:10px;color:#667085">équipe ${money(c.team)} · autres ${money(c.other)}</div>`;
    if (tr.children[10]) tr.children[10].innerHTML = revenue ? `<strong class="${margin < 0 ? "pj-bad" : "pj-good"}">${money(margin)}</strong> · ${(margin / revenue * 100).toFixed(1)} %` : "—";
    displayedMargin += margin;
    displayedRevenue += revenue;
  }
  const kpis = [...box.querySelectorAll(".pj-kpi")];
  const marginKpi = kpis.find(x => x.querySelector(".pj-label")?.textContent?.trim() === "Marge");
  if (marginKpi) {
    const pct = displayedRevenue > 0 ? displayedMargin / displayedRevenue * 100 : null;
    const val = marginKpi.querySelector(".pj-val");
    if (val) { val.classList.remove("good","bad"); val.classList.add(displayedMargin < 0 ? "bad" : "good"); val.textContent = `${money(displayedMargin)}${pct === null ? "" : ` · ${pct.toFixed(1)} %`}`; }
  }
  let banner = box.querySelector("[data-team-profitability]");
  if (!banner) { banner = document.createElement("div"); banner.dataset.teamProfitability = "1"; banner.style.cssText = "margin:10px 0;padding:10px 12px;border-radius:12px;background:#eef5ff;border:1px solid #d5e4fb;color:#102a56;font-size:12px;font-weight:700"; box.querySelector(".pj-kpis")?.after(banner); }
  const daily = readDailyRate(date);
  banner.innerHTML = daily ? `💶 Coût équipe intégré : <strong>${money(daily.total)}</strong> · ${daily.hours.toFixed(2)} h · <strong>${money(daily.rate)}/h</strong> · les matériaux saisis dans le coût équipe ne sont pas redéduits séparément.` : `💶 Coût équipe : les coûts répartis sur les OS sont intégrés à la marge. Saisis/sauvegarde le coût journalier pour afficher le coût horaire.`;
}

let timer;
function schedule(){ clearTimeout(timer); timer=setTimeout(()=>patch().catch(()=>{}),700); }
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.addEventListener("setom:planning-refresh", schedule);
window.addEventListener("setom:planning-updated", schedule);
setTimeout(schedule,1500);
