from pathlib import Path

planning = Path("src/planningOverlay.jsx")
text = planning.read_text(encoding="utf-8")
old = 'window.dispatchEvent(new CustomEvent("setom:navigate", { detail: { page: "chargement", orderId: selectedPlanningOrder.id, date: selectedPlanningOrder.planned_date || selectedDate } })); onClose();'
new = '''const loadingDate = selectedPlanningOrder.planned_date || selectedDate;
                  try { sessionStorage.setItem("setom:chargement:date:v1", loadingDate); localStorage.setItem("setom:chargement:date:v1", loadingDate); } catch {}
                  window.dispatchEvent(new CustomEvent("setom:chargement-date-changed", { detail: { date: loadingDate } }));
                  window.dispatchEvent(new CustomEvent("setom:navigate", { detail: { page: "chargement", orderId: selectedPlanningOrder.id, date: loadingDate } })); onClose();'''
if old in text and 'setom:chargement:date:v1' not in text:
    text = text.replace(old, new, 1)
planning.write_text(text, encoding="utf-8")

rot = Path("src/chargementRotations.js")
r = rot.read_text(encoding="utf-8")
anchor = 'const today = () => new Date().toISOString().slice(0, 10);'
replacement = '''const today = () => new Date().toISOString().slice(0, 10);
const selectedDate = () => {
  try {
    const value = sessionStorage.getItem("setom:chargement:date:v1") || localStorage.getItem("setom:chargement:date:v1") || "";
    return /^\\d{4}-\\d{2}-\\d{2}$/.test(value) ? value : today();
  } catch (_) { return today(); }
};'''
if anchor in r and 'const selectedDate = ()' not in r:
    r = r.replace(anchor, replacement, 1)
r = r.replace('return all[today()] || { rows: [] };', 'return all[selectedDate()] || { rows: [] };', 1)
r = r.replace('return all[today()] || { next: 1, assignments: {} };', 'return all[selectedDate()] || { next: 1, assignments: {} };', 1)
r = r.replace('all[today()] = value;', 'all[selectedDate()] = value;', 1)
if 'setom:chargement-date-changed' not in r:
    marker = 'window.addEventListener("setom:chargement-updated",'
    if marker in r:
        r = r.replace(marker, 'window.addEventListener("setom:chargement-date-changed", () => render());\n' + marker, 1)
rot.write_text(r, encoding="utf-8")
print("SETOM: planning date persisted for loading rotations")
