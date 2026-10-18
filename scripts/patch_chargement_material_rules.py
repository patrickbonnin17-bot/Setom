from pathlib import Path

path = Path("src/chargementRotations.js")
s = path.read_text(encoding="utf-8")

marker = 'function loadedOf(row) {\n  return Math.max(0, num(row.loaded));\n}\n'
helpers = r'''function loadedOf(row) {
  return Math.max(0, num(row.loaded));
}
function materialInfo(row) {
  const rawId = row?.materialId ?? row?.material_id ?? row?.material?.id;
  const rawLabel = row?.materialName ?? row?.material_name ?? row?.materialLabel ?? (typeof row?.material === "string" ? row.material : row?.material?.name);
  const label = String(rawLabel || "Matériau à sélectionner").trim() || "Matériau à sélectionner";
  const keySource = rawId != null && String(rawId).trim() ? `id:${String(rawId).trim()}` : `label:${label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim()}`;
  return { key: keySource, label };
}
'''
if marker in s and 'function materialInfo(row)' not in s:
    s = s.replace(marker, helpers, 1)

start = s.find('function buildPlan() {')
end = s.find('\nfunction styles()', start)
if start < 0 or end < 0:
    raise SystemExit('SETOM: buildPlan boundaries not found')

build = r'''function buildPlan() {
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
  const byMaterial = new Map();
  rs.forEach((row) => {
    const info = materialInfo(row);
    if (!byMaterial.has(info.key)) byMaterial.set(info.key, { ...info, planned: 0, loaded: 0 });
    const bucket = byMaterial.get(info.key);
    bucket.planned = round2(bucket.planned + plannedOf(row));
    bucket.loaded = round2(bucket.loaded + loadedOf(row));
  });
  const materialTotals = [...byMaterial.values()].sort((a, b) => b.planned - a.planned);
  const needed = Math.max(1, materialTotals.reduce((sum, m) => sum + Math.max(1, Math.ceil(m.planned / capacityT)), 0));
  const manualRotations = Math.max(0, (Number(state.next) || 1) - 1);
  const highestAssigned = Math.max(0, ...byRotation.keys());
  const rotationCount = Math.max(needed, manualRotations, highestAssigned, 1);
  for (let i = 1; i <= rotationCount; i += 1) if (!byRotation.has(i)) byRotation.set(i, []);
  const rotations = [...byRotation.entries()].sort((a, b) => a[0] - b[0]).map(([number, list]) => {
    const materialMap = new Map();
    list.forEach((row) => { const info = materialInfo(row); materialMap.set(info.key, info.label); });
    const materialLabels = [...materialMap.values()];
    return {
      number,
      rows: list,
      planned: round2(list.reduce((sum, r) => sum + plannedOf(r), 0)),
      loaded: round2(list.reduce((sum, r) => sum + loadedOf(r), 0)),
      osCount: new Set(list.map((r) => r.osId).filter(Boolean)).size,
      materialLabels,
      mixedMaterials: materialLabels.length > 1,
    };
  });
  return { rows: rs, totalPlanned: round2(totalPlanned), totalLoaded: round2(totalLoaded), needed, rotationCount, capacityT, rotations, materialTotals };
}
'''
s = s[:start] + build + s[end:]

start = s.find('function autoDistribute(plan) {')
end = s.find('\nfunction render()', start)
if start < 0 or end < 0:
    raise SystemExit('SETOM: autoDistribute boundaries not found')

auto = r'''function autoDistribute(plan) {
  const state = readRotations();
  const assignments = {};
  const capacity = Math.max(0.1, plan.capacityT);
  let rotation = 1;
  const groups = new Map();
  plan.rows.forEach((row) => {
    const info = materialInfo(row);
    if (!groups.has(info.key)) groups.set(info.key, { ...info, rows: [] });
    groups.get(info.key).rows.push(row);
  });
  const nextRows = [];
  for (const group of groups.values()) {
    let used = 0;
    for (const row of group.rows) {
      let plannedLeft = plannedOf(row);
      let loadedLeft = loadedOf(row);
      const groupId = row.splitGroupId || row.id;
      let splitIndex = 0;
      if (plannedLeft <= 0) {
        const copy = { ...row };
        delete copy.rotationSplit;
        delete copy.splitIndex;
        nextRows.push(copy);
        assignments[copy.id] = rotation;
        continue;
      }
      while (plannedLeft > 0.00001) {
        if (used >= capacity - 0.00001) { rotation += 1; used = 0; }
        const room = Math.max(0, round2(capacity - used));
        const chunk = Math.min(round2(plannedLeft), room);
        if (chunk <= 0) { rotation += 1; used = 0; continue; }
        splitIndex += 1;
        const chunkLoaded = Math.min(round2(loadedLeft), chunk);
        const isSplit = plannedOf(row) > chunk + 0.00001 || splitIndex > 1;
        const id = isSplit ? `${row.id}::rotation-${splitIndex}` : row.id;
        const copy = { ...row, id, planned: chunk, loaded: chunkLoaded, splitGroupId: groupId, splitIndex, rotationSplit: isSplit };
        nextRows.push(copy);
        assignments[id] = rotation;
        plannedLeft = round2(plannedLeft - chunk);
        loadedLeft = round2(loadedLeft - chunkLoaded);
        used = round2(used + chunk);
        if (used >= capacity - 0.00001 && plannedLeft > 0.00001) { rotation += 1; used = 0; }
      }
    }
    // Material change always starts a fresh rotation.
    if (used > 0) { rotation += 1; used = 0; }
  }
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const key = typeof selectedDate === "function" ? selectedDate() : today();
    all[key] = { ...(all[key] || {}), rows: nextRows };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (_) {}
  state.assignments = assignments;
  state.next = Math.max(rotation, plan.needed + 1);
  writeRotations(state);
}
'''
s = s[:start] + auto + s[end:]

# Manual assignment remains available; show the current row assignment in its selector.
s = s.replace('r === active ? "selected" : ""', 'r === getAssignment(row.id) ? "selected" : ""')

# Add material totals and forced-mix visibility.
needle = '    <div class="rtn-rotations">'
if needle in s and 'rtn-material-summary' not in s:
    block = '''    <div class="rtn-material-summary">
      ${plan.materialTotals.map((m) => `<div><b>${esc(m.label)}</b><span>${m.planned.toFixed(2)} t · ${Math.max(1, Math.ceil(m.planned / plan.capacityT))} rotation(s)</span></div>`).join("")}
    </div>
'''
    s = s.replace(needle, block + needle, 1)

old_card = '<b>Rotation ${r.number}</b>\n          <span>${r.osCount} OS · ${r.planned.toFixed(2)} t prévus · ${r.loaded.toFixed(2)} t chargés</span>'
new_card = '<b>Rotation ${r.number} ${r.mixedMaterials ? "· ⚠ MÉLANGE FORCÉ" : (r.materialLabels[0] ? `· ${esc(r.materialLabels[0])}` : "")}</b>\n          <span>${r.osCount} OS · ${r.planned.toFixed(2)} t prévus · ${r.loaded.toFixed(2)} t chargés${r.mixedMaterials ? ` · ${esc(r.materialLabels.join(" + "))}` : ""}</span>'
s = s.replace(old_card, new_card, 1)

s = s.replace('.rtn-table{margin:0 11px 11px;', '.rtn-material-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:7px;padding:0 11px 10px}.rtn-material-summary>div{border:1px solid #294957;border-radius:9px;padding:8px;background:#0a1e2a}.rtn-material-summary b{display:block;color:#fff;font-size:10px}.rtn-material-summary span{display:block;color:#8fa8b4;font-size:9px;margin-top:3px}.rtn-table{margin:0 11px 11px;', 1)
s = s.replace('Les affectations sont conservées pour la journée et restent séparées du statut de l\'OS.', 'Les affectations sont conservées pour la journée. Par défaut, une rotation ne contient qu’un seul matériau. Un regroupement de matériaux n’apparaît que si tu l’as forcé manuellement : il est signalé « mélange forcé ».')

path.write_text(s, encoding="utf-8")
print("SETOM: material-separated rotations with explicit manual forced-mix support")
