from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "src" / "main.jsx"
SRC = ROOT / "src" / "operationalIntelligenceBridge.js"
s = MAIN.read_text(encoding="utf-8")
marker = 'import "./chargementRealConsumptionOverlay";'
if 'import "./operationalIntelligenceBridge";' not in s:
    if marker not in s:
        raise SystemExit("operational intelligence: consumption overlay import not found")
    s = s.replace(marker, marker + '\nimport "./operationalIntelligenceBridge";', 1)
MAIN.write_text(s, encoding="utf-8")
SRC.write_text(r'''const STORAGE_KEY = "setom:chargement:v3";
const EVENT = "setom:operational-intelligence";

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const round = (v) => Math.round(n(v) * 100) / 100;

function selectedDate() {
  try { return sessionStorage.getItem("setom:chargement:date:v1") || localStorage.getItem("setom:chargement:date:v1") || new Date().toISOString().slice(0, 10); } catch (_) { return new Date().toISOString().slice(0, 10); }
}
function readRows(date) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Array.isArray(all?.[date]?.rows) ? all[date].rows : [];
  } catch (_) { return []; }
}
function build() {
  const date = selectedDate();
  const rows = readRows(date);
  const byOrder = new Map();
  rows.forEach((row) => {
    const key = String(row?.orderId || row?.workOrderId || row?.osId || "").trim();
    if (!key) return;
    const item = byOrder.get(key) || { orderId: row?.orderId || row?.workOrderId || "", osNumber: row?.osId || "OS", planned: 0, loaded: 0 };
    item.planned += Math.max(0, n(row?.planned));
    item.loaded += Math.max(0, n(row?.loaded));
    byOrder.set(key, item);
  });
  const items = [...byOrder.values()].map((x) => ({ ...x, remainingToLoad: round(Math.max(0, x.planned - x.loaded)), remainingLoaded: round(Math.max(0, x.loaded - n(x.consumed))), variance: round(n(x.consumed) - x.planned) }));
  const totalPlanned = round(items.reduce((s, x) => s + x.planned, 0));
  const totalLoaded = round(items.reduce((s, x) => s + x.loaded, 0));
  const totalConsumed = round(items.reduce((s, x) => s + n(x.consumed), 0));
  const alerts = items.filter((x) => x.planned > 0 && x.consumed > x.planned * 1.05).map((x) => ({ orderId: x.orderId, osNumber: x.osNumber, severity: "warning", value: round(x.consumed - x.planned), message: `Consommation supérieure de ${round(x.consumed - x.planned).toFixed(1)} t au prévu` }));
  return { date, totalPlanned, totalLoaded, totalConsumed, remainingToLoad: round(Math.max(0, totalPlanned - totalLoaded)), remainingLoaded: round(Math.max(0, totalLoaded - totalConsumed)), alerts, osCount: items.length };
}
function publish() {
  const state = build();
  window.setomOperationalIntelligence = state;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: state }));
}
if (typeof window !== "undefined") {
  publish();
  window.addEventListener("storage", publish);
  window.addEventListener("setom:chargement-date-changed", publish);
  window.addEventListener("setom:chargement-day-updated", publish);
  window.setTimeout(publish, 400);
  window.setInterval(publish, 3000);
}
''', encoding="utf-8")
print("SETOM: operational intelligence bridge wired")
