from pathlib import Path

path = Path("src/chargementRotations.js")
s = path.read_text(encoding="utf-8")

old = '''function setAssignment(id, rotation) {
  const state = readRotations();
  state.assignments = { ...(state.assignments || {}), [id]: rotation };
  state.next = Math.max(Number(state.next) || 1, rotation + 1);
  writeRotations(state);
}
'''
new = '''function setAssignment(id, rotation) {
  const state = readRotations();
  const target = Number(rotation) || 1;
  const currentRows = rows();
  const selectedRow = currentRows.find((row) => String(row.id) === String(id));
  const selectedMaterial = selectedRow ? materialInfo(selectedRow).key : null;
  const targetMaterials = new Set(
    currentRows
      .filter((row) => String(row.id) !== String(id) && getAssignment(row.id) === target)
      .map((row) => materialInfo(row).key)
      .filter(Boolean)
  );
  const createsForcedMix = Boolean(selectedMaterial && [...targetMaterials].some((key) => key !== selectedMaterial));
  state.assignments = { ...(state.assignments || {}), [id]: target };
  state.forcedMixes = { ...(state.forcedMixes || {}) };
  if (createsForcedMix) state.forcedMixes[target] = true;
  state.next = Math.max(Number(state.next) || 1, target + 1);
  writeRotations(state);
  if (createsForcedMix) toast(`⚠ Mélange forcé : ${materialInfo(selectedRow).label} ajouté à la rotation ${target}`);
}
'''
if old in s and 'createsForcedMix' not in s:
    s = s.replace(old, new, 1)

# A manual assignment is the only path that can create a mixed-material rotation.
if 'const selectedMaterial = selectedRow ? materialInfo(selectedRow).key : null;' not in s:
    raise SystemExit('SETOM: forced-mix guard was not installed')

# Keep the selected value of each row independent from the active rotation card.
s = s.replace(
    '${rotationOptions.map((r) => `<option value="${r}" ${r === active ? "selected" : ""}>Rotation ${r}</option>`).join("")}',
    '${rotationOptions.map((r) => `<option value="${r}" ${r === getAssignment(row.id) ? "selected" : ""}>Rotation ${r}</option>`).join("")}'
)

path.write_text(s, encoding="utf-8")
print("SETOM: manual multi-material assignment is explicitly tracked as forced mix")
