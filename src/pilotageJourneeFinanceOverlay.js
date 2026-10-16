const ROOT = "setom-pilotage-journee";
const n = (v) => {
  const x = Number(String(v ?? "").replace(/\s/g, "").replace("€", "").replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const money = (v) => `${n(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const dateOf = () => String(document.querySelector("input[type=date][data-setom-selected-date], .planning-date-input")?.value || new Date().toISOString().slice(0, 10)).slice(0, 10);

function readDailyCost(date) {
  try {
    const d = JSON.parse(localStorage.getItem(`setom-daily-team-costs-v1:${date}`) || "null");
    if (!d) return null;
    const total = ["personnel_amount", "vehicles_amount", "materials_amount", "equipment_amount", "fuel_amount", "other_amount"].reduce((s, k) => s + n(d[k]), 0);
    const hours = n(d.hours);
    return { total, hours, rate: hours > 0 ? total / hours : 0 };
  } catch { return null; }
}

function parseTable(box) {
  const rows = [...box.querySelectorAll(".pj-table tbody tr")];
  let surface = 0;
  let tonnage = 0;
  for (const tr of rows) {
    surface += n(String(tr.children[4]?.textContent || "").replace("m²", ""));
    tonnage += n(String(tr.children[5]?.textContent || "").replace("t", ""));
  }
  return { surface, tonnage, count: rows.length };
}

function style() {
  if (document.getElementById(`${ROOT}-finance-style`)) return;
  const s = document.createElement("style");
  s.id = `${ROOT}-finance-style`;
  s.textContent = `
    #${ROOT} .pj-finance-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}
    #${ROOT} .pj-finance-card{background:#fff;border:1px solid #e4eaf2;border-radius:12px;padding:10px;box-shadow:0 2px 8px rgba(16,42,86,.04)}
    #${ROOT} .pj-finance-label{font-size:10px;color:#667085;font-weight:700;text-transform:uppercase;letter-spacing:.02em}
    #${ROOT} .pj-finance-value{font-size:15px;font-weight:850;color:#102a56;margin-top:4px}
    #${ROOT} .pj-finance-sub{font-size:10px;color:#667085;margin-top:2px}
    @media(max-width:900px){#${ROOT} .pj-finance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:500px){#${ROOT} .pj-finance-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(s);
}

function patch() {
  const box = document.getElementById(ROOT);
  if (!box) return;
  const table = box.querySelector(".pj-table table");
  if (!table || !table.tBodies.length) return;
  style();
  const date = dateOf();
  const daily = readDailyCost(date);
  const { surface, tonnage } = parseTable(box);
  const marginKpi = [...box.querySelectorAll(".pj-kpi")].find(x => x.querySelector(".pj-label")?.textContent?.trim() === "Marge");
  const margin = marginKpi ? n(marginKpi.querySelector(".pj-val")?.textContent) : 0;
  const marginPerM2 = surface > 0 ? margin / surface : 0;
  const teamPerM2 = daily && surface > 0 ? daily.total / surface : 0;

  let grid = box.querySelector("[data-pilotage-finance]");
  if (!grid) {
    grid = document.createElement("div");
    grid.dataset.pilotageFinance = "1";
    grid.className = "pj-finance-grid";
    const truck = box.querySelector(".pj-truck");
    if (truck) truck.after(grid); else box.querySelector(".pj-kpis")?.after(grid);
  }

  grid.innerHTML = `
    <div class="pj-finance-card"><div class="pj-finance-label">Coût équipe / jour</div><div class="pj-finance-value">${daily ? money(daily.total) : "—"}</div><div class="pj-finance-sub">coût global saisi pour l'équipe</div></div>
    <div class="pj-finance-card"><div class="pj-finance-label">Coût équipe / heure</div><div class="pj-finance-value">${daily && daily.rate ? `${money(daily.rate)}/h` : "—"}</div><div class="pj-finance-sub">${daily ? `${daily.hours.toFixed(2)} h de journée` : "renseigner les heures"}</div></div>
    <div class="pj-finance-card"><div class="pj-finance-label">Coût équipe / m²</div><div class="pj-finance-value">${daily && surface ? `${money(teamPerM2)}/m²` : "—"}</div><div class="pj-finance-sub">${surface.toFixed(1)} m² planifiés/réalisés</div></div>
    <div class="pj-finance-card"><div class="pj-finance-label">Marge / m²</div><div class="pj-finance-value">${surface && margin ? `${money(marginPerM2)}/m²` : "—"}</div><div class="pj-finance-sub">${tonnage.toFixed(2)} t estimées · matériaux équipe inclus</div></div>`;
}

let timer;
function schedule() { clearTimeout(timer); timer = setTimeout(patch, 500); }
new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
window.addEventListener("setom:planning-refresh", schedule);
window.addEventListener("setom:planning-updated", schedule);
window.addEventListener("storage", schedule);
setTimeout(schedule, 1800);
