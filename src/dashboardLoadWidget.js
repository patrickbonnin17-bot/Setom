import { supabase } from "./supabase";

const STORAGE_KEY = "setom:dashboard-load:v1";
const ROOT_ID = "setom-dashboard-load-widget";

function todayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function readRows() {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const rows = Array.isArray(all[todayKey()]) ? all[todayKey()] : [];
    return rows.length ? rows : [{ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), material: "", planned: "", loaded: "", used: "" }];
  } catch (_) {
    return [{ id: String(Date.now()), material: "", planned: "", loaded: "", used: "" }];
  }
}

function writeRows(rows) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all[todayKey()] = rows;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (_) {}
}

function esc(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
}

function num(value) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function isDashboard() {
  const nodes = Array.from(document.querySelectorAll("button,a,[role='button']"));
  const dashboard = nodes.find((node) => /tableau de bord|dashboard/i.test((node.textContent || "").trim()));
  if (dashboard) {
    const cls = String(dashboard.className || "").toLowerCase();
    const active = dashboard.getAttribute("aria-current") === "page" || /active|selected|current/.test(cls);
    if (active) return true;
  }
  return !window.__setomCurrentSection || window.__setomCurrentSection === "dashboard";
}

function setSectionFromClick(target) {
  const text = (target?.textContent || "").trim().toLowerCase();
  if (!text) return;
  if (/tableau de bord|dashboard/.test(text)) window.__setomCurrentSection = "dashboard";
  else if (/planning/.test(text)) window.__setomCurrentSection = "planning";
  else if (/travaux/.test(text)) window.__setomCurrentSection = "travaux";
  else if (/ordre|\bos\b|classeur|archive|paramètres|parametres/.test(text)) window.__setomCurrentSection = "other";
}

function render() {
  const existing = document.getElementById(ROOT_ID);
  if (!isDashboard()) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;

  const host = document.createElement("section");
  host.id = ROOT_ID;
  host.innerHTML = `
    <div class="setom-load-card">
      <div class="setom-load-head">
        <div><div class="setom-load-kicker">LOGISTIQUE DU JOUR</div><h3>🚛 Chargement du jour</h3><div class="setom-load-date">${new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}</div></div>
        <button type="button" class="setom-load-add">+ Matériau</button>
      </div>
      <div class="setom-load-rows"></div>
      <div class="setom-load-summary"></div>
      <div class="setom-load-note">Les données saisies sont conservées pour la journée sur cet appareil.</div>
    </div>`;

  const style = document.createElement("style");
  style.textContent = `
    #${ROOT_ID}{width:100%;margin:0 0 18px;position:relative;z-index:20}
    .setom-load-card{background:linear-gradient(135deg,#fff,#f5f8fb);border:1px solid #dbe4ec;border-radius:18px;padding:18px;box-shadow:0 8px 24px rgba(20,40,60,.08);font-family:inherit}
    .setom-load-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}
    .setom-load-kicker{font-size:11px;font-weight:800;letter-spacing:.12em;color:#5d7182}.setom-load-card h3{margin:3px 0 2px;font-size:20px;color:#183247}.setom-load-date{text-transform:capitalize;color:#6d7e8b;font-size:13px}
    .setom-load-add{border:0;border-radius:10px;padding:9px 12px;background:#173d59;color:#fff;font-weight:700;cursor:pointer}
    .setom-load-row{display:grid;grid-template-columns:1.4fr repeat(4,minmax(85px,1fr)) 38px;gap:8px;align-items:end;padding:10px 0;border-top:1px solid #e4ebf0}
    .setom-load-label{display:block;font-size:11px;color:#687b89;font-weight:700;margin-bottom:5px}.setom-load-input{width:100%;box-sizing:border-box;border:1px solid #cbd8e1;border-radius:9px;padding:9px;background:#fff;font:inherit;min-height:38px}.setom-load-input:focus{outline:2px solid rgba(23,61,89,.18);border-color:#173d59}
    .setom-load-remove{height:38px;border:1px solid #d7e0e6;background:#fff;border-radius:9px;cursor:pointer;color:#9a3a3a;font-size:18px}
    .setom-load-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:13px}.setom-load-metric{background:#fff;border:1px solid #e0e7ec;border-radius:11px;padding:10px}.setom-load-metric span{display:block;font-size:11px;color:#718391}.setom-load-metric strong{display:block;margin-top:3px;font-size:18px;color:#183247}.setom-load-note{margin-top:10px;font-size:11px;color:#81909a}
    @media(max-width:760px){.setom-load-row{grid-template-columns:1fr 1fr}.setom-load-summary{grid-template-columns:1fr 1fr}.setom-load-head{align-items:center}.setom-load-remove{grid-column:auto}.setom-load-row>div:first-child{grid-column:1/-1}}
  `;
  document.head.appendChild(style);
  const anchor = document.querySelector("main") || document.querySelector("#root > div") || document.getElementById("root");
  if (anchor) anchor.prepend(host); else document.body.prepend(host);

  const rowsEl = host.querySelector(".setom-load-rows");
  const summaryEl = host.querySelector(".setom-load-summary");
  let rows = readRows();

  function refresh() {
    rowsEl.innerHTML = rows.map((row, index) => `
      <div class="setom-load-row" data-index="${index}">
        <div><label class="setom-load-label">Matériau</label><input class="setom-load-input" data-field="material" value="${esc(row.material)}" placeholder="Enrobé, grave…"></div>
        <div><label class="setom-load-label">Prévu (t)</label><input class="setom-load-input" inputmode="decimal" data-field="planned" value="${esc(row.planned)}" placeholder="0,0"></div>
        <div><label class="setom-load-label">Chargé réel (t)</label><input class="setom-load-input" inputmode="decimal" data-field="loaded" value="${esc(row.loaded)}" placeholder="0,0"></div>
        <div><label class="setom-load-label">Utilisé (t)</label><input class="setom-load-input" inputmode="decimal" data-field="used" value="${esc(row.used)}" placeholder="0,0"></div>
        <div><label class="setom-load-label">Restant (t)</label><div class="setom-load-input" style="display:flex;align-items:center;background:#eef6f1;font-weight:800">${(num(row.loaded)-num(row.used)).toFixed(2)} t</div></div>
        <button type="button" class="setom-load-remove" data-remove="${index}" aria-label="Supprimer">×</button>
      </div>`).join("");
    const planned = rows.reduce((s, r) => s + num(r.planned), 0);
    const loaded = rows.reduce((s, r) => s + num(r.loaded), 0);
    const used = rows.reduce((s, r) => s + num(r.used), 0);
    summaryEl.innerHTML = `<div class="setom-load-metric"><span>Tonnage prévu</span><strong>${planned.toFixed(2)} t</strong></div><div class="setom-load-metric"><span>Chargé réel</span><strong>${loaded.toFixed(2)} t</strong></div><div class="setom-load-metric"><span>Utilisé</span><strong>${used.toFixed(2)} t</strong></div><div class="setom-load-metric"><span>Restant estimé</span><strong>${(loaded-used).toFixed(2)} t</strong></div>`;
    writeRows(rows);
  }

  host.querySelector(".setom-load-add").addEventListener("click", () => {
    rows.push({ id: String(Date.now()), material: "", planned: "", loaded: "", used: "" });
    refresh();
  });
  rowsEl.addEventListener("input", (event) => {
    const input = event.target.closest("[data-field]");
    const rowEl = event.target.closest("[data-index]");
    if (!input || !rowEl) return;
    rows[Number(rowEl.dataset.index)][input.dataset.field] = input.value;
    refresh();
  });
  rowsEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    rows.splice(Number(button.dataset.remove), 1);
    if (!rows.length) rows.push({ id: String(Date.now()), material: "", planned: "", loaded: "", used: "" });
    refresh();
  });
  refresh();
}

document.addEventListener("click", (event) => {
  setSectionFromClick(event.target.closest("button,a,[role='button']"));
  setTimeout(render, 0);
}, true);

new MutationObserver(() => setTimeout(render, 0)).observe(document.body, { childList: true, subtree: true });
window.addEventListener("setom:planning-updated", () => setTimeout(render, 0));
setTimeout(render, 250);
