from pathlib import Path

p = Path("src/profitabilityOverlay.js")
s = p.read_text(encoding="utf-8")

old_consumption = '    const osConsumptions = consumptions.filter((x) => x.work_order_id === o.id);'
new_consumption = '''    // SETOM: profitability uses only real material consumption, never estimates.
    const osConsumptions = consumptions.filter((x) => x.work_order_id === o.id && x.estimated !== true);'''
if old_consumption in s and 'SETOM: profitability uses only real material consumption' not in s:
    s = s.replace(old_consumption, new_consumption, 1)

old_ca = '    const ca = num(c?.total_amount);'
new_ca = '''    // SETOM: only accepted/paid constats count as real CA. Brouillon remains forecast-only.
    const constatStatus = c?.status || "—";
    const acceptedCa = ["Validé", "Validé avec réserve", "Payé"].includes(constatStatus) ? num(c?.total_amount) : 0;
    const forecastCa = ["Brouillon", "À vérifier", "À valider"].includes(constatStatus) ? num(c?.total_amount) : 0;
    const ca = acceptedCa;'''
if old_ca in s and 'const acceptedCa =' not in s:
    s = s.replace(old_ca, new_ca, 1)

old_return = '    return { id: o.id, osNumber: o.os_number, status: o.status, date, plannedSurface: num(i?.planned_surface_m2 || o.planned_surface_m2), actualSurface: actualSurface || num(i?.actual_surface_m2), ca, materialCost, laborCost, directOtherCost, directCost, margin, marginPct, consumedTonnes, constatStatus: c?.status || "—" };'
new_return = '    return { id: o.id, osNumber: o.os_number, status: o.status, date, plannedSurface: num(i?.planned_surface_m2 || o.planned_surface_m2), actualSurface: actualSurface || num(i?.actual_surface_m2), ca, forecastCa, materialCost, laborCost, directOtherCost, directCost, margin, marginPct, consumedTonnes, constatStatus };'
if old_return in s and 'forecastCa, materialCost' not in s:
    s = s.replace(old_return, new_return, 1)

marker = '// SETOM: profitability rules applied'
if marker not in s:
    s += '\n' + marker + '\n'

p.write_text(s, encoding="utf-8")
