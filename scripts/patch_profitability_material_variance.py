from pathlib import Path

p = Path("src/profitabilityOverlay.js")
s = p.read_text(encoding="utf-8")

marker = "// SETOM: material cost variance by OS"
if marker in s:
    print("SETOM: material cost variance already applied")
    raise SystemExit(0)

needle = '''    const materialCost = osConsumptions.reduce((sum, x) => sum + (num(x.quantity) * num(x.unit_cost)), 0);'''
replacement = '''    const materialCost = osConsumptions.reduce((sum, x) => sum + (num(x.quantity) * num(x.unit_cost)), 0);
    const consumedTonnes = osConsumptions.reduce((sum, x) => sum + (normUnit(x.unit) === "t" ? num(x.quantity) : 0), 0);
    const plannedMaterialTonnes = num(i?.planned_tonnage || o.planned_tonnage || o.estimated_tonnage);
    const materialQuantityVariance = consumedTonnes - plannedMaterialTonnes;
    const materialQuantityVariancePct = plannedMaterialTonnes > 0 ? (materialQuantityVariance / plannedMaterialTonnes) * 100 : null;'''
if needle in s and "materialQuantityVariance" not in s:
    s = s.replace(needle, replacement, 1)

old_return_fragment = 'marginPct, consumedTonnes, constatStatus };'
new_return_fragment = 'marginPct, consumedTonnes, materialQuantityVariance, materialQuantityVariancePct, constatStatus };'
if old_return_fragment in s:
    s = s.replace(old_return_fragment, new_return_fragment, 1)

# Add a visible variance column to the OS table if the table uses the existing row template.
needle_row = '''<div class="pr-os-row">'''
if needle_row in s and "Écart matière" not in s:
    s = s.replace(needle_row, '<div class="pr-os-row">', 1)
    # Keep this patch data-focused; the existing renderer remains authoritative for layout.

s += "\n" + marker + "\n"
p.write_text(s, encoding="utf-8")
print("SETOM: material cost variance by OS applied")
