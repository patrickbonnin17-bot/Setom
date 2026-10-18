from pathlib import Path

path = Path("src/chargementRotations.js")
s = path.read_text(encoding="utf-8")

anchor = '''function loadedOf(row) {
  return Math.max(0, num(row.loaded));
}
'''
insert = '''function actualReferenceFor(row) {
  const osId = row?.osId || row?.workOrderId || row?.orderId || row?.id;
  if (!osId) return null;
  try {
    return JSON.parse(localStorage.getItem(`setom:actual-reference:v1:${osId}`) || "null");
  } catch (_) {
    return null;
  }
}
function actualSurfaceOf(row) {
  const ref = actualReferenceFor(row);
  return Math.max(0, num(ref?.totalSurfaceM2 ?? row?.actualSurfaceM2 ?? row?.actual_surface_m2));
}
function actualThicknessOf(row) {
  const ref = actualReferenceFor(row);
  return Math.max(0, num(ref?.thicknessCm ?? row?.actualThicknessCm ?? row?.actual_thickness_cm));
}
function actualOf(row) {
  return { surfaceM2: actualSurfaceOf(row), thicknessCm: actualThicknessOf(row) };
}
'''
if anchor not in s:
    raise SystemExit("SETOM: Chargement/Travaux bridge anchor missing")
if "function actualReferenceFor(row)" not in s:
    s = s.replace(anchor, anchor + insert, 1)

s = s.replace(
    '<div class="rtn-row head"><span>OS</span><span>MATÉRIAU</span><span>PRÉVU</span><span>CHARGÉ</span><span>RESTE</span><span>ROTATION</span></div>',
    '<div class="rtn-row head"><span>OS</span><span>MATÉRIAU</span><span>PRÉVU</span><span>CHARGÉ</span><span>RÉALISÉ</span><span>ÉCART</span><span>RESTE</span><span>ROTATION</span></div>'
)

old = '''          <span>${plannedOf(row).toFixed(2)} t</span>
          <span>${loadedOf(row).toFixed(2)} t</span>
          <span>${Math.max(0, round2(plannedOf(row) - loadedOf(row))).toFixed(2)} t</span>
          <select class="rtn-assignment" data-row-id="${esc(row.id)}">${rotationOptions.map((r) => `<option value="${r}" ${r === active ? "selected" : ""}>Rotation ${r}</option>`).join("")}</select>'''
new = '''          <span>${plannedOf(row).toFixed(2)} t</span>
          <span>${loadedOf(row).toFixed(2)} t</span>
          <span>${actualOf(row).surfaceM2.toFixed(2)} m²</span>
          <span>${(actualOf(row).surfaceM2 > 0 ? (actualOf(row).surfaceM2 - num(row.plannedSurfaceM2 ?? row.planned_surface_m2)) : 0).toFixed(2)} m²</span>
          <span>${Math.max(0, round2(plannedOf(row) - loadedOf(row))).toFixed(2)} t</span>
          <select class="rtn-assignment" data-row-id="${esc(row.id)}">${rotationOptions.map((r) => `<option value="${r}" ${r === getAssignment(row.id) ? "selected" : ""}>Rotation ${r}</option>`).join("")}</select>'''
if old in s:
    s = s.replace(old, new, 1)
elif "actualOf(row).surfaceM2" not in s:
    raise SystemExit("SETOM: Chargement/Travaux row bridge anchor missing")

s = s.replace(
    'grid-template-columns:1.1fr 1.1fr .55fr .55fr .55fr .65fr;',
    'grid-template-columns:1.05fr 1fr .55fr .55fr .7fr .65fr .55fr .65fr;',
    1
)
s = s.replace(
    '@media(max-width:900px){.rtn-kpis',
    '@media(max-width:900px){.rtn-row{grid-template-columns:1fr 1fr .6fr .6fr}.rtn-row:nth-child(n+2) .rtn-extra{display:none}.rtn-row.head{display:none}}\n    @media(max-width:900px){.rtn-kpis',
    1
)

if 'window.addEventListener("setom:actual-measurements-updated", schedule);' not in s:
    s = s.replace('window.addEventListener("setom:chargement-updated", schedule);', 'window.addEventListener("setom:chargement-updated", schedule);\nwindow.addEventListener("setom:actual-measurements-updated", schedule);\nwindow.addEventListener("setom:travaux-final-transmitted", schedule);', 1)

path.write_text(s, encoding="utf-8")
print("SETOM: Chargement now reads the Travaux actual reference and refreshes on real-measurement events")
