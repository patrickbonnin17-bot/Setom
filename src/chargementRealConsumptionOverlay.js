import { supabase } from "./supabase";

const ROOT_ID = "setom-chargement-page";
let refreshTimer = null;
let observer = null;
let applying = false;

const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const norm = (v) => String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esc = (v) => String(v ?? "").replace(/[&<>\"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c]));

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

function renderOrderConsumption(root, byOrder, date) {
  let panel = root.querySelector(".setom-real-consumption-by-os");
  if (!byOrder.length) { panel?.remove(); return; }
  if (!panel) {
    panel = document.createElement("section");
    panel.className = "setom-real-consumption-by-os";
    root.appendChild(panel);
  }
  panel.innerHTML = `
    <div class="setom-real-consumption-head">
      <div><strong>Consommation réelle par OS</strong><small>Travaux réels · ${esc(date)}</small></div>
      <span>${byOrder.reduce((s, x) => s + num(x.tonnes), 0).toFixed(2)} t</span>
    </div>
    <div class="setom-real-consumption-list">
      ${byOrder.map((item) => `
        <article class="setom-real-consumption-item" data-order-id="${esc(item.orderId)}">
          <div class="setom-real-consumption-os"><strong>${esc(item.osNumber)}</strong><small>${esc(item.address || "Adresse non renseignée")}</small></div>
          <div class="setom-real-consumption-materials">${item.materials.map((m) => `<span>${esc(m.name)} <b>${num(m.tonnes).toFixed(2)} t</b></span>`).join("")}</div>
          <strong class="setom-real-consumption-total">${num(item.tonnes).toFixed(2)} t</strong>
        </article>`).join("")}
    </div>`;
  if (!document.getElementById("setom-real-consumption-style-v2")) {
    const style = document.createElement("style");
    style.id = "setom-real-consumption-style-v2";
    style.textContent = `.setom-real-consumption-by-os{margin:0 11px 11px;background:#0b202b;border:1px solid #2b5062;border-radius:14px;color:#eaf5f8;overflow:hidden}.setom-real-consumption-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;background:linear-gradient(90deg,#0e2938,#102f3d);border-bottom:1px solid #2b5062}.setom-real-consumption-head strong{display:block;font-size:13px}.setom-real-consumption-head small{display:block;margin-top:3px;color:#8fa8b4;font-size:10px}.setom-real-consumption-head>span{font-size:18px;font-weight:900;color:#39df88}.setom-real-consumption-list{display:grid;gap:7px;padding:9px}.setom-real-consumption-item{display:grid;grid-template-columns:1.1fr 1.6fr auto;gap:10px;align-items:center;padding:9px 10px;background:#0d2634;border:1px solid #234757;border-radius:9px}.setom-real-consumption-os strong{display:block;font-size:11px}.setom-real-consumption-os small{display:block;color:#8da6b2;font-size:9px;margin-top:3px}.setom-real-consumption-materials{display:flex;flex-wrap:wrap;gap:5px}.setom-real-consumption-materials span{padding:4px 6px;border-radius:6px;background:#122f3d;color:#a9c0ca;font-size:9px}.setom-real-consumption-materials b{color:#eaf8ed}.setom-real-consumption-total{color:#39df88;font-size:13px;white-space:nowrap}@media(max-width:700px){.setom-real-consumption-item{grid-template-columns:1fr auto}.setom-real-consumption-materials{grid-column:1/-1}}`;
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
