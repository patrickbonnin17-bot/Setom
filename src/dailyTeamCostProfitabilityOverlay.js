import { supabase } from "./supabase";

const ROOT = "setom-pilotage-journee";
const TEAM_PREFIX = "Équipe ";
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const money = (v) => `${n(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dateOf = () => String(document.querySelector("input[type=date][data-setom-selected-date], .planning-date-input")?.value || new Date().toISOString().slice(0,10)).slice(0,10);

function readDailyCost(date) {
  try {
    const d = JSON.parse(localStorage.getItem(`setom-daily-team-costs-v1:${date}`) || "null");
    if (!d) return null;
    const total = ["personnel_amount","vehicles_amount","materials_amount","equipment_amount","fuel_amount","other_amount"].reduce((s,k)=>s+n(d[k]),0);
    const hours = n(d.hours);
    return hours > 0 ? { total, hours, rate: total / hours } : null;
  } catch { return null; }
}

function duration(date, start, end) {
  if (!start || !end) return 0;
  const a = new Date(`${date}T${String(start).slice(0,8)}`);
  let b = new Date(`${date}T${String(end).slice(0,8)}`);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return 0;
  if (b < a) b = new Date(b.getTime() + 24 * 3600000);
  const h = (b - a) / 3600000;
  return h > 0 && h <= 24 ? h : 0;
}

async function load(date) {
  const ir = await supabase.from("interventions")
    .select("id,work_order_id,planned_order,arrival_time,departure_time")
    .eq("planned_date", date).order("planned_order", { ascending:true });
  if (ir.error) throw ir.error;
  const ids = [...new Set((ir.data || []).map(x=>x.work_order_id).filter(Boolean))];
  if (!ids.length) return { byId:new Map(), revenue:new Map(), other:new Map() };
  const [wr, cr] = await Promise.all([
    supabase.from("constats").select("work_order_id,total_amount").in("work_order_id", ids),
    supabase.from("work_order_costs").select("work_order_id,amount,description").eq("cost_date", date).in("work_order_id", ids)
  ]);
  if (wr.error) throw wr.error;
  if (cr.error) throw cr.error;
  const byId = new Map();
  for (const i of ir.data || []) {
    const row = byId.get(i.work_order_id) || { hours:0, timed:0, interventionCount:0 };
    const h = duration(date, i.arrival_time, i.departure_time);
    row.hours += h;
    row.timed += h > 0 ? 1 : 0;
    row.interventionCount += 1;
    byId.set(i.work_order_id, row);
  }
  const revenue = new Map();
  for (const c of wr.data || []) revenue.set(c.work_order_id, Math.max(n(revenue.get(c.work_order_id)), n(c.total_amount)));
  const other = new Map();
  for (const c of cr.data || []) {
    if (String(c.description || "").startsWith(TEAM_PREFIX)) continue;
    other.set(c.work_order_id, n(other.get(c.work_order_id)) + n(c.amount));
  }
  return { byId, revenue, other };
}

function surfaceFromRow(tr) {
  return n(String(tr.children[4]?.textContent || "").replace("m²", ""));
}

async function patch() {
  const box = document.getElementById(ROOT);
  const table = box?.querySelector(".pj-table table");
  if (!table) return;
  const date = dateOf();
  const daily = readDailyCost(date);
  const ctx = await load(date);
  if (!ctx.byId.size) return;
  const wo = await supabase.from("work_orders").select("id,os_number").in("id", [...ctx.byId.keys()]);
  if (wo.error) throw wo.error;
  const osToId = new Map((wo.data || []).map(x=>[String(Number(x.os_number)),x.id]));
  const trs = [...table.querySelectorAll("tbody tr")];
  let revenueTotal = 0, marginTotal = 0, teamCostTotal = 0, otherCostTotal = 0, hoursTotal = 0, missingHours = 0, surfaceTotal = 0;

  for (const tr of trs) {
    const m = String(tr.children[1]?.textContent || "").match(/OS-(\d+)/);
    if (!m) continue;
    const id = osToId.get(String(Number(m[1])));
    if (!id) continue;
    const data = ctx.byId.get(id) || { hours:0, timed:0, interventionCount:0 };
    const revenue = n(ctx.revenue.get(id));
    const other = n(ctx.other.get(id));
    const team = daily ? data.hours * daily.rate : 0;
    const totalCost = team + other;
    const margin = revenue - totalCost;
    const surface = surfaceFromRow(tr);
    if (data.hours <= 0) missingHours += 1;
    hoursTotal += data.hours;
    revenueTotal += revenue;
    teamCostTotal += team;
    otherCostTotal += other;
    marginTotal += margin;
    surfaceTotal += surface;

    if (tr.children[9]) tr.children[9].innerHTML = `<strong>${money(totalCost)}</strong><div style="font-size:10px;color:#667085">équipe ${money(team)} · autres ${money(other)} · ${data.hours.toFixed(2)} h</div>`;
    if (tr.children[10]) tr.children[10].innerHTML = revenue
      ? `<strong class="${margin < 0 ? "pj-bad" : "pj-good"}">${money(margin)}</strong> · ${(margin / revenue * 100).toFixed(1)} %<div style="font-size:10px;color:#667085">${surface > 0 ? `${money(team / surface)}/m² équipe · ${money(margin / surface)}/m² marge` : ""}</div>`
      : "—";
  }

  const kpis = [...box.querySelectorAll(".pj-kpi")];
  const marginKpi = kpis.find(x=>x.querySelector(".pj-label")?.textContent?.trim()==="Marge");
  if (marginKpi) {
    const pct = revenueTotal > 0 ? marginTotal / revenueTotal * 100 : null;
    const val = marginKpi.querySelector(".pj-val");
    if (val) { val.classList.remove("good","bad"); val.classList.add(marginTotal < 0 ? "bad" : "good"); val.textContent = `${money(marginTotal)}${pct === null ? "" : ` · ${pct.toFixed(1)} %`}`; }
  }

  let banner = box.querySelector("[data-team-profitability]");
  if (!banner) {
    banner = document.createElement("div");
    banner.dataset.teamProfitability = "1";
    banner.style.cssText = "margin:10px 0;padding:10px 12px;border-radius:12px;background:#eef5ff;border:1px solid #d5e4fb;color:#102a56;font-size:12px;font-weight:700";
    box.querySelector(".pj-kpis")?.after(banner);
  }
  if (!daily) {
    banner.innerHTML = "💶 <strong>Coût équipe non renseigné.</strong> Saisis le coût global et les heures de la journée pour calculer la rentabilité réelle par OS.";
  } else {
    const delta = daily.hours - hoursTotal;
    const deltaText = Math.abs(delta) < 0.01 ? "✓ heures affectées = heures de journée" : `⚠ ${Math.abs(delta).toFixed(2)} h ${delta > 0 ? "non affectées" : "au-delà du total saisi"}`;
    banner.innerHTML = `💶 Coût équipe : <strong>${money(daily.total)}</strong> · <strong>${money(daily.rate)}/h</strong> · ${hoursTotal.toFixed(2)} h réelles sur les OS · ${deltaText}${missingHours ? ` · ⚠ ${missingHours} OS sans arrivée/départ` : ""}<br><span style="font-weight:500;color:#667085">Calcul : heures réelles d'intervention × coût horaire. Les coûts complémentaires hors « Équipe » sont ajoutés séparément ; les matériaux déjà inclus dans le coût équipe ne sont pas redéduits.</span>`;
  }

  table.dataset.teamCostPatched = `${date}:${daily?.rate || 0}:${hoursTotal.toFixed(2)}`;

  window.dispatchEvent(new CustomEvent("setom:profitability-metrics", { detail:{ date, revenue:revenueTotal, teamCost:teamCostTotal, otherCost:otherCostTotal, margin:marginTotal, hours:hoursTotal, surface:surfaceTotal, dailyHours:daily?.hours || 0, dailyCost:daily?.total || 0, rate:daily?.rate || 0, missingHours } }));
}

let timer;
function schedule(){ clearTimeout(timer); timer=setTimeout(()=>patch().catch(()=>{}),700); }
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.addEventListener("setom:planning-refresh", schedule);
window.addEventListener("setom:planning-updated", schedule);
window.addEventListener("storage", schedule);
setTimeout(schedule,1500);
