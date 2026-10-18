import { supabase } from "./supabase";

const STORAGE_KEY = "setom:chargement:v3";
const ROTATION_KEY = "setom:chargement:rotations:v1";
const VEHICLE_KEY = "setom:vehicle:config:v1";
const ROOT_ID = "setom-chargement-rotations";
const DEFAULT_PAYLOAD_T = 7;

const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => Math.round(num(v) * 100) / 100;
const esc = (v) => String(v ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));

function readVehiclePayload() {
  const candidates = [
    "setom:vehicle:config:v1",
    "setom:vehicle-config",
    "setom:truck-config",
    "setom:chargement:vehicle",
  ];
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const value = JSON.parse(raw);
      const payload = num(value?.payload_t ?? value?.payloadT ?? value?.charge_utile_t ?? value?.chargeUtileT ?? value?.maxPayloadT ?? value?.capacity_t);
      if (payload > 0) return payload;
    } catch (_) {}
  }
  return DEFAULT_PAYLOAD_T;
}

function payloadCapacity() {
  return Math.max(0.1, round2(readVehiclePayload()));
}

function readDay() {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return all[today()] || { rows: [] };
  } catch (_) {
    return { rows: [] };
  }
}
function readRotations() {
  try {
    const all = JSON.parse(localStorage.getItem(ROTATION_KEY) || "{}");
    return all[today()] || { next: 1, assignments: {} };
  } catch (_) {
    return { next: 1, assignments: {} };
  }
}
function writeRotations(value) {
  try {
    const all = JSON.parse(localStorage.getItem(ROTATION_KEY) || "{}");
    all[today()] = value;
    localStorage.setItem(ROTATION_KEY, JSON.stringify(all));
  } catch (_) {}
}
function rows() {
  const day = readDay();
  return Array.isArray(day.rows) ? day.rows.filter(Boolean) : [];
}
function getAssignment(id) {
  return Number(readRotations().assignments?.[id]) || 1;
}
function setAssignment(id, rotation) {
  const state = readRotations();
  state.assignments = { ...(state.assignments || {}), [id]: rotation };
  state.next = Math.max(Number(state.next) || 1, rotation + 1);
  writeRotations(state);
}
function plannedOf(row) {
  return Math.max(0, num(row.planned));
}
function loadedOf(row) {
  return Math.max(0, num(row.loaded));
}
function buildPlan() {
  const rs = rows();
  const capacityT = payloadCapacity();
  const state = readRotations();
  const byRotation = new Map();
  rs.forEach((row) => {
    const r = getAssignment(row.id);
    if (!byRotation.has(r)) byRotation.set(r, []);
    byRotation.get(r).push(row);
  });
  const totalPlanned = rs.reduce((s, r) => s + plannedOf(r), 0);
  const totalLoaded = rs.reduce((s, r) => s + loadedOf(r), 0);
  const needed = Math.max(1, Math.ceil(totalPlanned / capacityT));
  // Keep manually created empty rotations visible instead of losing them on re-render.
  const manualRotations = Math.max(0, (Number(state.next) || 1) - 1);
  const rotationCount = Math.max(needed, manualRotations, ...byRotation.keys(), 1);
  for (let i = 1; i <= rotationCount; i += 1) if (!byRotation.has(i)) byRotation.set(i, []);
  const rotations = [...byRotation.entries()].sort((a, b) => a[0] - b[0]).map(([number, list]) => ({
    number,
    rows: list,
    planned: round2(list.reduce((s, r) => s + plannedOf(r), 0)),
    loaded: round2(list.reduce((s, r) => s + loadedOf(r), 0)),
    osCount: new Set(list.map((r) => r.osId).filter(Boolean)).size,
  }));
  return { rows: rs, totalPlanned: round2(totalPlanned), totalLoaded: round2(totalLoaded), needed, rotationCount, capacityT, rotations };
}

function styles() {
  if (document.getElementById(`${ROOT_ID}-style`)) return;
  const s = document.createElement("style");
  s.id = `${ROOT_ID}-style`;
  s.textContent = `
    #${ROOT_ID}{margin:0 11px 11px;border:1px solid #315365;border-radius:14px;background:linear-gradient(145deg,#0d2533,#081a25);color:#eaf2f7;overflow:hidden;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
    .rtn-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #284857;background:linear-gradient(90deg,#102b3a,#0b202d)}
    .rtn-title{font-size:13px;font-weight:900}.rtn-sub{display:block;color:#8fa8b4;font-size:10px;font-weight:500;margin-top:2px}
    .rtn-actions{display:flex;gap:6px;flex-wrap:wrap}.rtn-actions button{border:1px solid #466272;background:#102d3b;color:#f2f7f9;border-radius:8px;padding:7px 10px;font-weight:800;cursor:pointer}.rtn-actions .primary{background:#0d9d4c;border-color:#2ad478}
    .rtn-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;padding:9px 11px}.rtn-kpi{border:1px solid #284957;border-radius:9px;padding:8px;background:#0a1e2a}.rtn-kpi span{display:block;color:#8fa8b4;font-size:9px}.rtn-kpi strong{display:block;color:#fff;font-size:16px;margin-top:3px}.rtn-kpi.good strong{color:#42e18a}.rtn-kpi.warn strong{color:#ffd36a}
    .rtn-rotations{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;padding:0 11px 10px}.rtn-rot{border:1px solid #2d4e5d;border-radius:9px;padding:9px;background:#0c2330;cursor:pointer}.rtn-rot.active{border-color:#18c5ff;box-shadow:0 0 0 1px #18c5ff44 inset}.rtn-rot b{display:block;font-size:11px}.rtn-rot span{display:block;color:#9bb0bb;font-size:9px;margin-top:3px}.rtn-rot .meter{height:6px;background:#1d3947;border-radius:8px;margin-top:7px;overflow:hidden}.rtn-rot .meter i{display:block;height:100%;background:#14c2f4}
    .rtn-table{margin:0 11px 11px;border:1px solid #294957;border-radius:9px;overflow:hidden}.rtn-row{display:grid;grid-template-columns:1.1fr 1.1fr .55fr .55fr .55fr .65fr;gap:7px;align-items:center;padding:7px 9px;border-bottom:1px solid #1d3947;font-size:10px}.rtn-row:last-child{border-bottom:0}.rtn-row.head{background:#0e2a39;color:#91a8b3;font-weight:900;text-transform:uppercase;font-size:8px}.rtn-row strong{color:#fff}.rtn-row select{width:100%;border:1px solid #385767;background:#071923;color:#fff;border-radius:6px;padding:5px;font-size:10px}.rtn-note{padding:0 11px 10px;color:#8fa8b4;font-size:9px}.rtn-empty{padding:14px;color:#8fa8b4;text-align:center}
    @media(max-width:900px){.rtn-kpis{grid-template-columns:repeat(3,1fr)}.rtn-rotations{grid-template-columns:repeat(2,1fr)}.rtn-row{grid-template-columns:1fr 1fr .6fr .6fr}.rtn-row:nth-child(n+2) .rtn-extra{display:none}.rtn-row.head{display:none}}
    @media(max-width:600px){.rtn-kpis{grid-template-columns:repeat(2,1fr)}.rtn-rotations{grid-template-columns:1fr}.rtn-row{grid-template-columns:1fr 1fr}.rtn-row select{grid-column:span 2}}
  `;
  document.head.appendChild(s);
}

function toast(message) {
  const old = document.querySelector(".s3-toast");
  if (old) old.remove();
  const el = document.createElement("div");
  el.className = "s3-toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function autoDistribute(plan) {
  const state = readRotations();
  const assignments = {};
  let rotation = 1;
  let used = 0;
  plan.rows.forEach((row) => {
    const p = plannedOf(row);
    if (p > 0 && used > 0 && used + p > plan.capacityT) {
      rotation += 1;
      used = 0;
    }
    assignments[row.id] = rotation;
    used += p;
    if (used >= plan.capacityT) {
      rotation += 1;
      used = 0;
    }
  });
  state.assignments = assignments;
  state.next = Math.max(rotation, plan.needed + 1);
  writeRotations(state);
}

function render() {
  const host = document.getElementById("setom-chargement-page");
  if (!host) return;
  styles();
  const plan = buildPlan();
  let active = Number(host.dataset.rotationActive || 1);
  if (active > Math.max(plan.rotationCount, 1)) active = 1;
  host.dataset.rotationActive = String(active);
  let panel = document.getElementById(ROOT_ID);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = ROOT_ID;
    host.appendChild(panel);
  }
  const remaining = Math.max(0, round2(plan.totalPlanned - plan.totalLoaded));
  const capacity = Math.max(0, round2(plan.rotationCount * plan.capacityT - plan.totalPlanned));
  const selected = plan.rotations.find((r) => r.number === active) || plan.rotations[0];
  const rotationOptions = Array.from({ length: Math.max(plan.rotationCount + 1, 3) }, (_, i) => i + 1);
  panel.innerHTML = `
    <div class="rtn-head">
      <div><div class="rtn-title">🚛 ROTATIONS DU CAMION</div><span class="rtn-sub">Répartition automatique des besoins de la journée sur des chargements de ${plan.capacityT.toFixed(1)} t maximum.</span></div>
      <div class="rtn-actions"><button class="rtn-auto">⚡ Répartir automatiquement</button><button class="rtn-add primary">＋ Nouvelle rotation</button></div>
    </div>
    <div class="rtn-kpis">
      <div class="rtn-kpi"><span>TONNAGE PRÉVU</span><strong>${plan.totalPlanned.toFixed(2)} t</strong></div>
      <div class="rtn-kpi"><span>DÉJÀ CHARGÉ</span><strong>${plan.totalLoaded.toFixed(2)} t</strong></div>
      <div class="rtn-kpi good"><span>RESTE À CHARGER</span><strong>${remaining.toFixed(2)} t</strong></div>
      <div class="rtn-kpi warn"><span>ROTATIONS NÉCESSAIRES</span><strong>${plan.needed}</strong></div>
      <div class="rtn-kpi"><span>CAPACITÉ TOTALE</span><strong>${(plan.rotationCount * plan.capacityT).toFixed(1)} t</strong></div>
    </div>
    <div class="rtn-rotations">
      ${plan.rotations.map((r) => `
        <div class="rtn-rot ${r.number === active ? "active" : ""}" data-rotation="${r.number}">
          <b>Rotation ${r.number}</b>
          <span>${r.osCount} OS · ${r.planned.toFixed(2)} t prévus · ${r.loaded.toFixed(2)} t chargés</span>
          <div class="meter"><i style="width:${Math.min(100, r.planned / plan.capacityT * 100)}%"></i></div>
        </div>`).join("")}
    </div>
    <div class="rtn-table">
      <div class="rtn-row head"><span>OS</span><span>MATÉRIAU</span><span>PRÉVU</span><span>CHARGÉ</span><span>RESTE</span><span>ROTATION</span></div>
      ${selected?.rows?.length ? selected.rows.map((row) => `
        <div class="rtn-row">
          <strong>${esc(row.osId || "OS à affecter")}</strong>
          <span>${esc(row.material || "Matériau à sélectionner")}</span>
          <span>${plannedOf(row).toFixed(2)} t</span>
          <span>${loadedOf(row).toFixed(2)} t</span>
          <span>${Math.max(0, round2(plannedOf(row) - loadedOf(row))).toFixed(2)} t</span>
          <select class="rtn-assignment" data-row-id="${esc(row.id)}">${rotationOptions.map((r) => `<option value="${r}" ${r === active ? "selected" : ""}>Rotation ${r}</option>`).join("")}</select>
        </div>`).join("") : `<div class="rtn-empty">Aucun chargement n'est encore affecté à cette rotation.</div>`}
    </div>
    <div class="rtn-note">Capacité du camion : <strong>${plan.capacityT.toFixed(1)} t</strong>. La valeur provient de la configuration véhicule lorsqu'elle est disponible, sinon la référence reste ${DEFAULT_PAYLOAD_T.toFixed(1)} t. Les affectations sont conservées pour la journée et restent séparées du statut de l'OS.</div>
  `;

  panel.querySelectorAll("[data-rotation]").forEach((el) => el.addEventListener("click", () => {
    host.dataset.rotationActive = el.dataset.rotation;
    render();
  }));
  panel.querySelectorAll(".rtn-assignment").forEach((el) => el.addEventListener("change", () => {
    setAssignment(el.dataset.rowId, Number(el.value));
    host.dataset.rotationActive = el.value;
    render();
    toast(`OS affecté à la rotation ${el.value}`);
  }));
  panel.querySelector(".rtn-auto")?.addEventListener("click", () => {
    autoDistribute(plan);
    host.dataset.rotationActive = "1";
    render();
    toast("Répartition automatique effectuée");
  });
  panel.querySelector(".rtn-add")?.addEventListener("click", () => {
    const state = readRotations();
    const next = Math.max(plan.rotationCount + 1, Number(state.next) || 1);
    state.next = next + 1;
    writeRotations(state);
    host.dataset.rotationActive = String(next);
    render();
    toast(`Rotation ${next} créée`);
  });
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    if (document.getElementById("setom-chargement-page")) render();
  });
}

const observer = new MutationObserver((mutations) => {
  const relevant = mutations.some((m) => {
    const target = m.target instanceof Element ? m.target : null;
    if (target?.closest?.(`#${ROOT_ID}`)) return false;
    if (m.type !== "childList") return false;
    return [...m.addedNodes, ...m.removedNodes].some((node) => node instanceof Element && node.id !== ROOT_ID && !node.closest?.(`#${ROOT_ID}`));
  });
  if (relevant) schedule();
});
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("setom:planning-updated", schedule);
window.addEventListener("setom:chargement-updated", schedule);
window.addEventListener("storage", (e) => { if (e.key === STORAGE_KEY || e.key === ROTATION_KEY || e.key === VEHICLE_KEY) schedule(); });
schedule();
