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

async function loadRealConsumption(date) {
  const { data: consumptions, error } = await supabase
    .from("truck_material_consumptions")
    .select("work_order_id,intervention_id,material_id,consumption_date,quantity,unit,estimated")
    .eq("consumption_date", date)
    .eq("estimated", false);
  if (error || !consumptions?.length) return [];

  const materialIds = [...new Set(consumptions.map((r) => r.material_id).filter(Boolean))];
  if (!materialIds.length) return [];
  const { data: materials } = await supabase
    .from("materials")
    .select("id,name")
    .in("id", materialIds);
  const names = new Map((materials || []).map((m) => [m.id, m.name]));

  const totals = new Map();
  for (const row of consumptions) {
    const unit = norm(row.unit);
    if (unit !== "t" && unit !== "tonne" && unit !== "tonnes") continue;
    const name = names.get(row.material_id) || "Matériau non renseigné";
    const key = norm(name);
    totals.set(key, {
      name,
      tonnes: (totals.get(key)?.tonnes || 0) + num(row.quantity),
      interventions: (totals.get(key)?.interventions || 0) + 1
    });
  }
  return [...totals.values()];
}

function updateMetrics(root) {
  const rows = [...root.querySelectorAll("tbody tr")];
  let planned = 0, loaded = 0, used = 0;
  rows.forEach((tr) => {
    const inputs = [...tr.querySelectorAll("input[data-field]")];
    const value = (field) => num(inputs.find((x) => x.dataset.field === field)?.value);
    const p = value("planned");
    const l = value("loaded");
    const u = value("used");
    planned += p; loaded += l; used += u;
    const cells = tr.children;
    if (cells[4]) cells[4].textContent = (l - u).toFixed(2);
    if (cells[5]) cells[5].textContent = (l - p).toFixed(2);
  });
  const metrics = [...root.querySelectorAll(".setom-load-metric strong")];
  if (metrics[0]) metrics[0].textContent = `${planned.toFixed(2)} t`;
  if (metrics[1]) metrics[1].textContent = `${loaded.toFixed(2)} t`;
  if (metrics[2]) metrics[2].textContent = `${used.toFixed(2)} t`;
  if (metrics[3]) metrics[3].textContent = `${(loaded - used).toFixed(2)} t`;
  if (metrics[4]) metrics[4].textContent = `${(loaded - planned).toFixed(2)} t`;
}

async function apply(date) {
  const root = document.getElementById(ROOT_ID);
  if (!root || !date || applying) return;
  applying = true;
  try {
    const totals = await loadRealConsumption(date);
    if (!totals.length) return;
    const byName = new Map(totals.map((x) => [norm(x.name), x]));
    const rows = [...root.querySelectorAll("tbody tr")];
    rows.forEach((tr) => {
      const materialInput = tr.querySelector('input[data-field="material"]');
      const usedInput = tr.querySelector('input[data-field="used"]');
      if (!materialInput || !usedInput) return;
      const item = byName.get(norm(materialInput.value));
      if (!item) return;
      usedInput.value = item.tonnes.toFixed(2);
      usedInput.dataset.source = "travaux_reels";
      usedInput.title = `Consommation réelle issue des Travaux · ${item.interventions} enregistrement(s)`;
      usedInput.style.background = "#eaf7f0";
      usedInput.style.borderColor = "#9bd3b2";
      const label = tr.querySelector("td:first-child");
      if (label && !label.querySelector(".setom-real-consumption-badge")) {
        const badge = document.createElement("small");
        badge.className = "setom-real-consumption-badge";
        badge.textContent = "Travaux réels";
        badge.style.cssText = "display:block;margin-top:4px;color:#087443;font-weight:800;font-size:10px";
        label.appendChild(badge);
      }
    });
    updateMetrics(root);
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
    refreshTimer = setTimeout(() => apply(date), 150);
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
