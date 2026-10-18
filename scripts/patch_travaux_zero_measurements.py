from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
old = '''actual_road_surface_m2: os.rehabilitationZone === "Chaussée" || os.rehabilitationZone === "Chaussée + trottoir" ? (roadActual || null) : null, actual_sidewalk_surface_m2: os.rehabilitationZone === "Trottoir" || os.rehabilitationZone === "Chaussée + trottoir" ? (sidewalkActual || null) : null, actual_other_surface_m2: os.rehabilitationZone === "Autre" ? (otherActual || null) : null, updated_by: user.id'''
new = '''actual_road_surface_m2: os.rehabilitationZone === "Chaussée" || os.rehabilitationZone === "Chaussée + trottoir" ? (realRoadSurface === "" ? null : roadActual) : null, actual_sidewalk_surface_m2: os.rehabilitationZone === "Trottoir" || os.rehabilitationZone === "Chaussée + trottoir" ? (realSidewalkSurface === "" ? null : sidewalkActual) : null, actual_other_surface_m2: os.rehabilitationZone === "Autre" ? (realOtherSurface === "" ? null : otherActual) : null, updated_by: user.id'''
if old not in text:
    raise SystemExit("SETOM: Travaux zero-measurement source pattern not found")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("SETOM: explicit zero Travaux measurements are preserved instead of coerced to NULL")
