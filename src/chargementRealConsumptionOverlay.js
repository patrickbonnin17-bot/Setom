import { supabase } from "./supabase";

const ROOT_ID = "setom-chargement-page";
const STORAGE_KEY = "setom:chargement:v3";
let refreshTimer = null;
let observer = null;
let applying = false;

const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const norm = (v) => String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc = (v) => String(v ?? "").replace(/[&<>\"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c]));
const round2 = (v) => Math.round(num(v) * 100) / 100;

function readPlannedDay(date) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const day = all?.[date];
    const rows = Array.isArray(day?.rows) ? day.rows.filter(Boolean) : [];
    const byOrder = new Map();
    rows.forEach((row) => {
      const key = String(row?.orderId || row?.workOrderId || row?.osId || "").trim();
      if (!key) return;
      const item = byOrder.get(key) || {
        orderId: row?.orderId || row?.workOrderId || "",
        osNumber: row?.osId || "OS non renseignée",
        planned: 0,
        loaded: 0,
        material: row?.material || ""
      };
      item.planned += Math.max(0, num(row?.planned));
      item.loaded += Math.max(0, num(row?.loaded));
      if (!item.material && row?.material) item.material = row.material;
      byOrder.set(key, item);
    });
    return [...byOrder.values()];
  } catch (_) {
    return [];
  }
}

async function loadRealConsumption(date) {
  const { data: consumptions, error } = await supabase
    .from("truck_material_consumptions")
    .select("work_order_id,intervention_id,material_id,consumption_date,quantity,unit,estimated")
    .eq("consumption_date", date)
    .eq("estimated", false);
  if (error || !consumptions?.length) return { totals: [], byOrder: [] };

  const materialIds = [...new Set(consumptions.map((r) => r.material_id).filter(Boolean))];
  const orderIds = [...new Set(consumptions.map((r) => r.work_order_id).filter(Boolean))];
  const [{ data: materials }, { data: orders }] = await Promise.all([
    materialIds.length ? supabase.from("materials").select("id,name").in("id", materialIds) : Promise.resolve({ data: [] }),
    orderIds.length ? supabase.from("work_orders").select("id,os_number,address,material_id,material_detail,planned_surface_m2").in("id", orderIds) : Promise.resolve({ data: [] })
  ]);
  const names = new Map((materials || []).map((m) => [m.id, m.name]));
  const orderMap = new Map((orders || []).map((o) => [o.id, o]));
  const totalMap = new Map();
  const orderMapTotals = new Map();

  for (const row of consumptions) {
    const unit = norm(row.unit);
    if (unit !== "t" && unit !== "tonne" && unit !== "tonnes") continue;
    const tonnes = num(row.quantity);
    if (!tonnes) continue;
    const material = names.get(row.material_id) || "Matériau non renseigné";
    const materialKey = norm(material);
    const total = totalMap.get(materialKey) || { name: material, tonnes: 0, interventions: 0 };
    total.tonnes += tonnes;
    total.interventions += 1;
    totalMap.set(materialKey, total);

    const order = orderMap.get(row.work_order_id);
    const orderKey = String(row.work_order_id || "unknown");
    const detail = orderMapTotals.get(orderKey) || {
      orderId: row.work_order_id || "",
      osNumber: order?.os_number || "OS non renseignée",
      address: order?.address || "",
      tonnes: 0,
      materials: new Map()
    };
    detail.tonnes += tonnes;
    detail.materials.set(materialKey, (detail.materials.get(materialKey) || 0) + tonnes);
    orderMapTotals.set(orderKey, detail);
  }

  const byOrder = [...orderMapTotals.values()].map((item) => ({
    ...item,
    materials: [...item.materials.entries()].map(([key, tonnes]) => ({ name: totalMap.get(key)?.name || key, tonnes }))
  })).sort((a, b) => b.tonnes - a.tonnes);

  return { totals: [...totalMap.values()], byOrder };
}

function updateMetrics(root, totals) {
  const rows = [...root.querySelectorAll("tbody tr")];
  let planned = 0, loaded = 0;
  rows.forEach((tr) => {
    const inputs = [...tr.querySelectorAll("input[data-field]")];
    const value = (field) => num(inputs.find((x) => x.dataset.field === field)?.value);
    planned += value("planned");
    loaded += value("loaded");
  });
  const used = totals.reduce((sum, item) => sum + num(item.tonnes), 0);
  const metrics = [...root.querySelectorAll(".setom-load-metric strong")];
  if (metrics[0]) metrics[0].textContent = `${planned.toFixed(2)} t`;
  if (metrics[1]) metrics[1].textContent = `${loaded.toFixed(2)} t`;
  if (metrics[2]) metrics[2].textContent = `${used.toFixed(2)} t`;
  if (metrics[3]) metrics[3].textContent = `${(loaded - used).toFixed(2)} t`;
  if (metrics[4]) metrics[4].textContent = `${(loaded - planned).toFixed(2)} t`;
}

function mergeOrderPilot(date, byOrder) {
  const planned = readPlannedDay(date);
  const byKey = new Map();
  planned.forEach((item) => {
    byKey.set(String(item.orderId || item.osNumber), {
      orderId: item.orderId || "",
      osNumber: item.osNumber || "OS non renseignée",
      address: "",
      planned: round2(item.planned),
      loaded: round2(item.loaded),
      consumed: 0,
      material: item.material || "",
      materials: []
    });
  });
  byOrder.forEach((item) => {
    const key = String(item.orderId || item.osNumber);
    const existing = byKey.get(key) || {
      orderId: item.orderId || "",
      osNumber: item.osNumber || "OS non renseignée",
      address: item.address || "",
      planned: 0,
      loaded: 0,
      consumed: 0,
      material: "",
      materials: []
    };
    existing.address = existing.address || item.address || "";
    existing.consumed = round2(item.tonnes);
    existing.materials = item.materials || [];
    byKey.set(key, existing);
  });
  return [...byKey.values()].map((item) => ({
    ...item,
    remaining: round2(Math.max(0, item.planned - item.loaded)),
    variance: round2(item.consumed - item.planned),
    consumptionGap: round2(item.loaded - item.consumed)
  })).sort((a, b) => b.planned - a.planned || String(a.osNumber).localeCompare(String(b.osNumber)));
}

function renderOrderConsumption(root, byOrder, date) {
  const pilot = mergeOrderPilot(date, byOrder);
  let panel = root.querySelector(".setom-real-consumption-by-os");
  if (!pilot.length) { panel?.remove(); return; }
  if (!panel) {
    panel = document.createElement("section");
    panel.className = "setom-real-consumption-by-os";
    root.appendChild(panel);
  }
  const totalPlanned = pilot.reduce((s, x) => s + num(x.planned), 0);
  const totalLoaded = pilot.reduce((s, x) => s + num(x.loaded), 0);
  const totalConsumed = pilot.reduce((s, x) => s + num(x.consumed), 0);
  panel.innerHTML = `
    <div class="setom-real-consumption-head">
      <div><strong>Pilotage réel par OS</strong><small>Prévu → chargé → consommé · ${esc(date)}</small></div>
      <div class="setom-real-consumption-head-kpis"><span>${totalPlanned.toFixed(2)} t prévu</span><span>${totalLoaded.toFixed(2)} t chargé</span><b>${totalConsumed.toFixed(2)} t consommé</b></div>
    </div>
    <div class="setom-real-consumption-list">
      ${pilot.map((item) => {
        const status = item.consumed > 0 && item.planned > 0 && item.consumed > item.planned * 1.05 ? "attention" : item.remaining > 0 ? "encours" : "ok";
        const statusLabel = status === "attention" ? "Surconsommation" : status === "encours" ? "À charger" : "Suivi OK";
        return `
        <article class="setom-real-consumption-item ${status}" data-order-id="${esc(item.orderId)}">
          <div class="setom-real-consumption-os"><strong>${esc(item.osNumber)}</strong><small>${esc(item.address || item.material || "Adresse / matériau non renseigné")}</small><em>${statusLabel}</em></div>
          <div class="setom-real-consumption-values">
            <span>Prévu <b>${item.planned.toFixed(2)} t</b></span>
            <span>Chargé <b>${item.loaded.toFixed(2)} t</b></span>
            <span>Consommé <b>${item.consumed.toFixed(2)} t</b></span>
            <span>Reste <b>${item.remaining.toFixed(2)} t</b></span>
          </div>
          <div class="setom-real-consumption-materials">${item.materials.length ? item.materials.map((m) => `<span>${esc(m.name)} <b>${num(m.tonnes).toFixed(2)} t</b></span>`).join("") : `<span>${esc(item.material || "Matériau à préciser")}</span>`}</div>
        </article>`;
      }).join("")}
    </div>`;
  if (!document.getElementById("setom-real-consumption-style-v3")) {
    const style = document.createElement("style");
    style.id = "setom-real-consumption-style-v3";
    style.textContent = `.setom-real-consumption-by-os{margin:0 11px 11px;background:#0b202b;border:1px solid #2b5062;border-radius:14px;color:#eaf5f8;overflow:hidden}.setom-real-consumption-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;background:linear-gradient(90deg,#0e2938,#102f3d);border-bottom:1px solid #2b5062}.setom-real-consumption-head strong{display:block;font-size:13px}.setom-real-consumption-head small{display:block;margin-top:3px;color:#8fa8b4;font-size:10px}.setom-real-consumption-head-kpis{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.setom-real-consumption-head-kpis span,.setom-real-consumption-head-kpis b{padding:5px 7px;border-radius:7px;background:#102d3b;color:#a9c0ca;font-size:9px}.setom-real-consumption-head-kpis b{color:#39df88}.setom-real-consumption-list{display:grid;gap:7px;padding:9px}.setom-real-consumption-item{display:grid;grid-template-columns:1fr 1.6fr 1fr;gap:10px;align-items:center;padding:9px 10px;background:#0d2634;border:1px solid #234757;border-radius:9px}.setom-real-consumption-item.attention{border-color:#a97935}.setom-real-consumption-item.encours{border-color:#2c7898}.setom-real-consumption-os strong{display:block;font-size:11px}.setom-real-consumption-os small{display:block;color:#8da6b2;font-size:9px;margin-top:3px}.setom-real-consumption-os em{display:inline-block;margin-top:5px;padding:3px 5px;border-radius:5px;background:#123342;color:#8fd8f2;font-size:8px;font-style:normal;font-weight:900}.setom-real-consumption-item.attention .setom-real-consumption-os em{color:#ffd36a;background:#3b2c16}.setom-real-consumption-values{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.setom-real-consumption-values span{padding:5px 6px;border-radius:6px;background:#122f3d;color:#8fa8b4;font-size:8px}.setom-real-consumption-values b{display:block;color:#edf7fa;font-size:10px;margin-top:2px}.setom-real-consumption-materials{display:flex;flex-wrap:wrap;gap:5px}.setom-real-consumption-materials span{padding:4px 6px;border-radius:6px;background:#122f3d;color:#a9c0ca;font-size:9px}.setom-real-consumption-materials b{color:#eaf8ed}@media(max-width:900px){.setom-real-consumption-item{grid-template-columns:1fr 1fr}.setom-real-consumption-values{grid-column:1/-1}}@media(max-width:700px){.setom-real-consumption-head{display:block}.setom-real-consumption-head-kpis{justify-content:flex-start;margin-top:8px}.setom-real-consumption-item{grid-template-columns:1fr}.setom-real-consumption-values{grid-template-columns:1fr 1fr}}`;
    document.head.appendChild(style);
  }
}

async function apply(date) {
  const root = document.getElementById(ROOT_ID);
  if (!root || !date || applying) return;
  applying = true;
  try {
    const { totals, byOrder } = await loadRealConsumption(date);
    updateMetrics(root, totals);
    renderOrderConsumption(root, byOrder, date);
  } finally {
    applying = false;
  }
}

function start() {
  if (observer) observer.disconnect();
  observer = new MutationObserver(() => {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const date = root.dataset.date || new Date().toISOString().slice(0, 10);
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => apply(date), 180);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const root = document.getElementById(ROOT_ID);
  if (root) apply(root.dataset.date || new Date().toISOString().slice(0, 10));
}

if (typeof window !== "undefined") {
  window.setomRefreshRealConsumption = () => {
    const root = document.getElementById(ROOT_ID);
    if (root) apply(root.dataset.date || new Date().toISOString().slice(0, 10));
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
