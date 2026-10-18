const RULES = {
  enrobe: { label: "Enrobé", minimum: 5, productivityTPerPersonHour: 0.85 },
  beton: { label: "Béton", minimum: 3, productivityTPerPersonHour: 0.65 },
  terrassement: { label: "Terrassement", minimum: 2, productivityTPerPersonHour: 3.0 },
  autre: { label: "Autre", minimum: 2, productivityTPerPersonHour: 1.5 },
};
const OBS_KEY = "setom:productivity:observations:v1";
const CONFIG_KEY = "setom:staffing:rules:v1";
const LOAD_KEY = "setom:chargement:v3";

const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const round = (v) => Math.round(num(v) * 10) / 10;
const today = () => new Date().toISOString().slice(0, 10);
const normalize = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function readRules() {
  try {
    const custom = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    return Object.fromEntries(Object.entries(RULES).map(([key, rule]) => [key, { ...rule, ...(custom[key] || {}) }]));
  } catch (_) { return RULES; }
}
function classify(row) {
  const text = normalize(`${row?.material || ""} ${row?.type || ""} ${row?.nature || ""}`);
  if (/enrobe|bitume|grave-bitume|gb/.test(text)) return "enrobe";
  if (/beton|betonnage|dalle|bordure/.test(text)) return "beton";
  if (/terrassement|remblai|deblai|grave/.test(text)) return "terrassement";
  return "autre";
}
function readRows() {
  try {
    const all = JSON.parse(localStorage.getItem(LOAD_KEY) || "{}");
    const day = all[today()] || { rows: [] };
    return Array.isArray(day.rows) ? day.rows.filter(Boolean) : [];
  } catch (_) { return []; }
}
function readObservations() {
  try {
    const value = JSON.parse(localStorage.getItem(OBS_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (_) { return []; }
}

export function recordProductivityObservation(observation) {
  const entry = {
    id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    date: observation?.date || today(),
    orderId: observation?.orderId || null,
    workType: observation?.workType || "autre",
    surfaceM2: num(observation?.surfaceM2),
    quantityT: num(observation?.quantityT),
    thicknessCm: num(observation?.thicknessCm),
    crewCount: Math.max(0, Math.round(num(observation?.crewCount))),
    plannedHours: num(observation?.plannedHours),
    actualHours: num(observation?.actualHours),
    trafficLevel: observation?.trafficLevel || "normal",
    accessLevel: observation?.accessLevel || "normal",
    weather: observation?.weather || "unknown",
    equipment: observation?.equipment || null,
  };
  const next = [...readObservations(), entry].slice(-2000);
  try { localStorage.setItem(OBS_KEY, JSON.stringify(next)); } catch (_) {}
  window.dispatchEvent(new CustomEvent("setom:productivity-observation", { detail: entry }));
  return entry;
}

function historicalSignal(type) {
  const observations = readObservations().filter((o) => o.workType === type && num(o.actualHours) > 0 && num(o.quantityT) > 0 && num(o.crewCount) > 0);
  if (!observations.length) return { count: 0, confidence: "initiale", productivity: null };
  const weighted = observations.reduce((acc, o) => {
    const productivity = num(o.quantityT) / Math.max(0.25, num(o.actualHours) * num(o.crewCount));
    return { total: acc.total + productivity, count: acc.count + 1 };
  }, { total: 0, count: 0 });
  return { count: weighted.count, confidence: weighted.count >= 30 ? "bonne" : weighted.count >= 10 ? "moyenne" : "faible", productivity: weighted.total / weighted.count };
}

function buildRecommendation() {
  const rules = readRules();
  const rows = readRows();
  const grouped = {};
  rows.forEach((row) => {
    const type = classify(row);
    if (!grouped[type]) grouped[type] = { type, rows: [], quantityT: 0, os: new Set() };
    grouped[type].rows.push(row);
    grouped[type].quantityT += Math.max(0, num(row.planned));
    if (row.osId) grouped[type].os.add(row.osId);
  });
  const recommendations = Object.values(grouped).map((group) => {
    const rule = rules[group.type] || rules.autre;
    const signal = historicalSignal(group.type);
    const productivity = signal.productivity || num(rule.productivityTPerPersonHour);
    const baseHours = group.quantityT / Math.max(0.1, productivity * Math.max(1, rule.minimum));
    const crew = Math.max(rule.minimum, Math.ceil(group.quantityT / Math.max(0.1, productivity * 8)));
    return { ...group, osCount: group.os.size, minimum: rule.minimum, crew, estimatedHours: round(baseHours), confidence: signal.confidence, historyCount: signal.count };
  });
  const total = recommendations.reduce((sum, r) => sum + r.crew, 0);
  return { date: today(), recommendations, totalRecommended: total, observations: readObservations().length };
}

function styles() {
  if (document.getElementById("setom-staffing-intelligence-css")) return;
  const s = document.createElement("style"); s.id = "setom-staffing-intelligence-css";
  s.textContent = `
    .setom-staffing-panel{margin:0 0 14px;padding:16px;background:linear-gradient(180deg,#fbfdfe,#fff);border:1px solid #d4e2ea;border-radius:12px;box-shadow:0 4px 14px rgba(17,42,62,.04)}
    .setom-staffing-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:12px}.setom-staffing-head h2{margin:3px 0;font-size:16px;color:#102b43}.setom-staffing-head p{margin:0;color:#758692;font-size:10px}.setom-staffing-badge{padding:5px 8px;border-radius:999px;background:#eef7fb;color:#16708e;font-size:9px;font-weight:800}
    .setom-staffing-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.setom-staffing-card{border:1px solid #e0e8ed;border-radius:9px;padding:10px;background:#fff}.setom-staffing-card b{display:block;color:#17334d;font-size:11px}.setom-staffing-card small{display:block;color:#81919c;font-size:9px;margin-top:3px}.setom-staffing-card strong{display:block;margin-top:8px;font-size:21px;color:#123c56}.setom-staffing-card em{font-style:normal;color:#7b8d98;font-size:9px}.setom-staffing-foot{margin-top:10px;padding:9px;background:#f5f8fa;border-radius:8px;color:#788995;font-size:9px;line-height:1.45}.setom-staffing-foot strong{color:#17334d}
    @media(max-width:900px){.setom-staffing-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.setom-staffing-head{align-items:flex-start;flex-direction:column}.setom-staffing-grid{grid-template-columns:1fr}}
  `; document.head.appendChild(s);
}

export function renderStaffingIntelligence(host) {
  if (!host) return;
  styles();
  const state = buildRecommendation();
  const rows = state.recommendations;
  host.innerHTML = `<section class="setom-staffing-panel">
    <div class="setom-staffing-head"><div><span class="setom-eyebrow">INTELLIGENCE EFFECTIFS</span><h2>Prévision des équipes</h2><p>Première couche de calcul : règles métier + tonnage planifié. L’apprentissage historique viendra ensuite.</p></div><span class="setom-staffing-badge">${state.totalRecommended} pers. recommandées</span></div>
    ${rows.length ? `<div class="setom-staffing-grid">${rows.map((r) => `<article class="setom-staffing-card"><b>${r.type === "enrobe" ? "Enrobé" : r.type === "beton" ? "Béton" : r.type === "terrassement" ? "Terrassement" : "Autres travaux"}</b><small>${r.osCount} OS · ${round(r.quantityT)} t prévues · minimum ${r.minimum}</small><strong>${r.crew} pers.</strong><em>≈ ${r.estimatedHours} h · confiance ${r.confidence}</em></article>`).join("")}</div>` : `<div class="setom-staffing-foot">Aucun tonnage planifié n'est encore disponible pour calculer un besoin d'effectif.</div>`}
    <div class="setom-staffing-foot"><strong>Fondation IA :</strong> SETOM conservera progressivement le temps réel, l'effectif, l'épaisseur, la circulation, les accès, la météo et le matériel par OS. Les recommandations futures seront apprises sur vos propres chantiers et resteront contraintes par les minima métier configurés.</div>
  </section>`;
}

export function mountStaffingIntelligence() {
  const mount = () => {
    const dashboard = document.querySelector(".setom-dashboard") || document.querySelector("[data-page='dashboard']") || document.getElementById("setom-dashboard");
    if (!dashboard) return;
    let host = document.getElementById("setom-staffing-intelligence");
    if (!host) { host = document.createElement("div"); host.id = "setom-staffing-intelligence"; dashboard.appendChild(host); }
    renderStaffingIntelligence(host);
  };
  mount();
  window.addEventListener("setom:operational-intelligence", mount);
  window.addEventListener("setom:chargement-date-changed", mount);
  window.addEventListener("storage", mount);
}

if (typeof window !== "undefined") {
  window.setomStaffingIntelligence = { recordProductivityObservation, buildRecommendation };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountStaffingIntelligence, { once: true });
  else mountStaffingIntelligence();
}
