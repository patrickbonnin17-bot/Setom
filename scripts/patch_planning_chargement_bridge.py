from pathlib import Path

path = Path("src/planningOverlay.jsx")
text = path.read_text(encoding="utf-8")

if 'SETOM_PLANNING_TONNAGE_KEY' not in text:
    anchor = 'const fullOsNumber = (order) => `${String(order.osLabel || "OS").trim()}-${new Date(order.creation_date).getFullYear()}-${String(order.os_number).padStart(5, "0")}`;'
    replacement = '''const fullOsNumber = (order) => `${String(order.osLabel || "OS").trim()}-${new Date(order.creation_date).getFullYear()}-${String(order.os_number).padStart(5, "0")}`;
const SETOM_PLANNING_TONNAGE_KEY = "setom:planning:tonnage:v1";
const SETOM_CHARGEMENT_KEY = "setom:chargement:v3";

function readPlanningTonnage() {
  try { return JSON.parse(localStorage.getItem(SETOM_PLANNING_TONNAGE_KEY) || "{}"); } catch { return {}; }
}

function writePlanningTonnage(value) {
  try { localStorage.setItem(SETOM_PLANNING_TONNAGE_KEY, JSON.stringify(value)); } catch {}
}

function syncPlanningToChargement(orders, tonnageByOrder) {
  try {
    const all = JSON.parse(localStorage.getItem(SETOM_CHARGEMENT_KEY) || "{}");
    const plannedIds = new Set();
    for (const order of orders || []) {
      if (!order?.planned_date) continue;
      const tonnage = Math.max(0, Number(tonnageByOrder?.[order.id] || 0));
      const date = order.planned_date;
      if (!all[date]) all[date] = { rows: [] };
      const rows = Array.isArray(all[date].rows) ? all[date].rows.filter(Boolean) : [];
      const rowId = `planning-${order.id}`;
      plannedIds.add(rowId);
      const existing = rows.find((row) => row.id === rowId);
      const nextRow = {
        ...(existing || {}),
        id: rowId,
        source: "planning",
        orderId: order.id,
        osId: fullOsNumber(order),
        material: String(order.material_detail || "Intervention").trim() || "Intervention",
        planned: tonnage,
        loaded: Math.max(0, Number(existing?.loaded || 0)),
      };
      all[date].rows = [...rows.filter((row) => row.id !== rowId), nextRow];
    }
    Object.keys(all).forEach((date) => {
      if (!Array.isArray(all[date]?.rows)) return;
      all[date].rows = all[date].rows.filter((row) => row?.source !== "planning" || plannedIds.has(row.id));
    });
    localStorage.setItem(SETOM_CHARGEMENT_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event("setom:chargement-updated"));
  } catch (error) {
    console.warn("SETOM: impossible de synchroniser le planning vers le chargement", error);
  }
}'''
    if anchor not in text:
        raise SystemExit("SETOM: planning tonnage helper anchor not found")
    text = text.replace(anchor, replacement, 1)

state_anchor = '  const [routeTeamId, setRouteTeamId] = useState("");'
state_replacement = '''  const [routeTeamId, setRouteTeamId] = useState("");
  const [planningTonnage, setPlanningTonnage] = useState(() => readPlanningTonnage());'''
if state_anchor in text and 'const [planningTonnage, setPlanningTonnage]' not in text:
    text = text.replace(state_anchor, state_replacement, 1)

sync_anchor = '  useEffect(() => { load(); }, []);'
sync_replacement = '''  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!orders.length) return;
    syncPlanningToChargement(orders, planningTonnage);
  }, [orders, planningTonnage]);'''
if sync_anchor in text and 'syncPlanningToChargement(orders, planningTonnage)' not in text:
    text = text.replace(sync_anchor, sync_replacement, 1)

# Add a single explicit tonnage input to the selected OS detail. This avoids inventing a density/thickness conversion from surface area.
needle = '<div><dt>Surface</dt><dd>{selectedPlanningOrder.planned_surface_m2 ? `${selectedPlanningOrder.planned_surface_m2} m²` : "Non renseignée"}</dd></div>'
replacement = needle + '''<div><dt>Prévision chargement</dt><dd><div className="setom-planning-tonnage-field"><input type="number" min="0" step="0.01" value={planningTonnage[selectedPlanningOrder.id] ?? ""} onChange={(event) => { const value = event.target.value; setPlanningTonnage((current) => { const next = { ...current, [selectedPlanningOrder.id]: value === "" ? 0 : Math.max(0, Number(value)) }; writePlanningTonnage(next); syncPlanningToChargement(orders, next); return next; }); }} placeholder="0,00" /><span>t</span></div><small>Cette valeur alimente directement les rotations du camion.</small></dd></div>'''
if needle in text and 'setom-planning-tonnage-field' not in text:
    text = text.replace(needle, replacement, 1)

# Make the daily material strip also show the planned loading tonnage.
old = 'current.surface += Number(order.planned_surface_m2) || 0;\n      current.count += 1;'
new = 'current.surface += Number(order.planned_surface_m2) || 0;\n      current.tonnage += Math.max(0, Number(planningTonnage[order.id] || 0));\n      current.count += 1;'
if old in text:
    text = text.replace(old, new, 1)
old2 = 'const current = map.get(name) || { name, surface: 0, count: 0 };'
new2 = 'const current = map.get(name) || { name, surface: 0, tonnage: 0, count: 0 };'
if old2 in text:
    text = text.replace(old2, new2, 1)
old3 = 'return [...map.values()].sort((a, b) => b.surface - a.surface);'
new3 = 'return [...map.values()].sort((a, b) => b.surface - a.surface);'

old_strip = '<span key={item.name}><b>{item.name}</b> · {item.surface.toLocaleString("fr-FR")} m² · {item.count} OS</span>'
new_strip = '<span key={item.name}><b>{item.name}</b> · {item.surface.toLocaleString("fr-FR")} m² · {item.tonnage.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t · {item.count} OS</span>'
if old_strip in text:
    text = text.replace(old_strip, new_strip, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: planning to loading bridge applied")
