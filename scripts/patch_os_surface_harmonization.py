from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

marker = "// SETOM: planned surface harmonization"
if marker in text:
    print("SETOM: planned surface harmonization already applied")
    raise SystemExit(0)

needle = '        const day = plannedDay ? plannedDay.charAt(0).toUpperCase() + plannedDay.slice(1) : null;\n'
if needle not in text:
    raise SystemExit("SETOM: formatted OS day block not found")

replacement = needle + '''        const plannedSurfaceM2 = row.planned_surface_m2 != null
          ? Number(row.planned_surface_m2)
          : ((Number(row.planned_road_surface_m2) || 0) + (Number(row.planned_sidewalk_surface_m2) || 0) + (Number(row.planned_other_surface_m2) || 0));\n        const normalizedPlannedSurfaceM2 = Number.isFinite(plannedSurfaceM2) && plannedSurfaceM2 > 0 ? plannedSurfaceM2 : null;\n'''
text = text.replace(needle, replacement, 1)

needle_return = '          trade: row.material_detail || "Intervention", sector: sectorById.get(row.sector_id) || "Non classé", sectorId: row.sector_id || "", status: row.status || "Nouveau",\n'
if needle_return not in text:
    raise SystemExit("SETOM: formatted OS return block not found")

replacement_return = needle_return + '          plannedSurfaceM2: normalizedPlannedSurfaceM2,\n'
text = text.replace(needle_return, replacement_return, 1)

text = text.replace('          quantity: row.planned_surface_m2 == null ? "" : row.planned_surface_m2 + " m²",\n', '          quantity: normalizedPlannedSurfaceM2 == null ? "" : normalizedPlannedSurfaceM2 + " m²",\n', 1)

text = text.replace(marker, marker, 1) if marker in text else text
text = text.replace('function App() {', marker + '\n\nfunction App() {', 1)
path.write_text(text, encoding="utf-8")
print("SETOM: planned surface harmonized")
