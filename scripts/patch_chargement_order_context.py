from pathlib import Path

path = Path("src/chargementRotations.js")
r = path.read_text(encoding="utf-8")

anchor = 'const today = () => new Date().toISOString().slice(0, 10);'
replacement = '''const today = () => new Date().toISOString().slice(0, 10);
function selectedOrderId() {
  try {
    return String(sessionStorage.getItem("setom:chargement:order:v1") || localStorage.getItem("setom:chargement:order:v1") || "").trim();
  } catch (_) {
    return "";
  }
}'''
if anchor in r and 'function selectedOrderId()' not in r:
    r = r.replace(anchor, replacement, 1)

if '.rtn-row.selected-order' not in r:
    r = r.replace(
        '.rtn-row:last-child{border-bottom:0}',
        '.rtn-row:last-child{border-bottom:0}.rtn-row.selected-order{background:linear-gradient(90deg,#123c50,#0d2938);box-shadow:inset 3px 0 0 #19c8ff}',
        1,
    )

old = '''  const selected = plan.rotations.find((r) => r.number === active) || plan.rotations[0];
  const rotationOptions = Array.from({ length: Math.max(plan.rotationCount + 1, 3) }, (_, i) => i + 1);'''
new = '''  const targetOrderId = selectedOrderId();
  const targetRow = targetOrderId ? plan.rows.find((row) => String(row.orderId || "") === targetOrderId) : null;
  const targetRotation = targetRow ? getAssignment(targetRow.id) : null;
  if (targetRotation && host.dataset.rotationActive !== String(targetRotation)) {
    active = Number(targetRotation) || active;
    host.dataset.rotationActive = String(active);
  }
  const selected = plan.rotations.find((r) => r.number === active) || plan.rotations[0];
  const rotationOptions = Array.from({ length: Math.max(plan.rotationCount + 1, 3) }, (_, i) => i + 1);'''
if old in r and 'const targetOrderId = selectedOrderId();' not in r:
    r = r.replace(old, new, 1)

old_row = '''        <div class="rtn-row">
          <strong>${esc(row.osId || "OS à affecter")}</strong>'''
new_row = '''        <div class="rtn-row ${targetOrderId && String(row.orderId || "") === targetOrderId ? "selected-order" : ""}">
          <strong>${esc(row.osId || "OS à affecter")}${targetOrderId && String(row.orderId || "") === targetOrderId ? " · OS sélectionné" : ""}</strong>'''
if old_row in r and 'selected-order' not in r.split(old_row, 1)[0][-500:]:
    r = r.replace(old_row, new_row, 1)

if 'setom:chargement-order-changed' not in r:
    r += '''\nwindow.addEventListener("setom:chargement-order-changed", () => schedule());\n'''

path.write_text(r, encoding="utf-8")
print("SETOM: chargement focuses the OS selected from planning")
