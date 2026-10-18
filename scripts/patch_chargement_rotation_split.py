from pathlib import Path
import re

path = Path("src/chargementRotations.js")
s = path.read_text(encoding="utf-8")

start = s.find("function autoDistribute(plan) {")
if start < 0:
    raise SystemExit("SETOM: autoDistribute function not found")
end = s.find("\nfunction render()", start)
if end < 0:
    raise SystemExit("SETOM: render boundary not found")

replacement = r'''function autoDistribute(plan) {
  const state = readRotations();
  const source = plan.rows.map((row) => ({ ...row }));
  const capacity = Math.max(0.1, plan.capacityT);
  const nextRows = [];
  const assignments = {};
  let rotation = 1;
  let used = 0;

  const startRotation = () => {
    if (used > 0) {
      rotation += 1;
      used = 0;
    }
  };

  source.forEach((row) => {
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
      return;
    }

    while (plannedLeft > 0.00001) {
      if (used >= capacity - 0.00001) startRotation();
      const room = Math.max(0, round2(capacity - used));
      const chunk = Math.min(round2(plannedLeft), room);
      if (chunk <= 0) {
        rotation += 1;
        used = 0;
        continue;
      }

      splitIndex += 1;
      const chunkLoaded = Math.min(round2(loadedLeft), chunk);
      const isSplit = plannedOf(row) > chunk + 0.00001 || splitIndex > 1;
      const id = isSplit ? `${row.id}::rotation-${splitIndex}` : row.id;
      const copy = {
        ...row,
        id,
        planned: chunk,
        loaded: chunkLoaded,
        splitGroupId: groupId,
        splitIndex,
        rotationSplit: isSplit,
      };
      nextRows.push(copy);
      assignments[id] = rotation;

      plannedLeft = round2(plannedLeft - chunk);
      loadedLeft = round2(loadedLeft - chunkLoaded);
      used = round2(used + chunk);
      if (used >= capacity - 0.00001 && plannedLeft > 0.00001) startRotation();
    }
  });

  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const key = today();
    all[key] = { ...(all[key] || {}), rows: nextRows };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (_) {}

  state.assignments = assignments;
  state.next = Math.max(rotation + 1, plan.needed + 1);
  writeRotations(state);
}
'''

s = s[:start] + replacement + s[end:]

# Make split rows visually explicit without changing the data model.
needle = '<strong>${esc(row.osId || "OS à affecter")}</strong>'
insert = '<strong>${esc(row.osId || "OS à affecter")}${row.rotationSplit ? ` <small style="color:#18c5ff">· lot ${row.splitIndex}</small>` : ""}</strong>'
if needle in s and insert not in s:
    s = s.replace(needle, insert, 1)

path.write_text(s, encoding="utf-8")
print("SETOM: oversized loading lines now split across payload-sized rotations")
