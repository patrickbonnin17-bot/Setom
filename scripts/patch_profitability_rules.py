from pathlib import Path

p = Path("src/profitabilityOverlay.js")
s = p.read_text(encoding="utf-8")

old_consumption = '    const osConsumptions = consumptions.filter((x) => x.work_order_id === o.id);'
new_consumption = '''    // SETOM: profitability uses only real material consumption, never estimates.
    const osConsumptions = consumptions.filter((x) => x.work_order_id === o.id && x.estimated !== true);'''
if old_consumption in s and 'SETOM: profitability uses only real material consumption' not in s:
    s = s.replace(old_consumption, new_consumption, 1)

old_constats = '''  const latestConstatByOS = new Map();
  constats.forEach((c) => { if (!latestConstatByOS.has(c.work_order_id)) latestConstatByOS.set(c.work_order_id, c); });'''
new_constats = '''  // SETOM: never let a later Brouillon replace an accepted constat in real CA.
  // Priority for real CA: Payé > Validé avec réserve > Validé.
  // Forecast remains available separately from the latest draft/verification state.
  const constatsByOS = new Map();
  constats.forEach((c) => {
    if (!constatsByOS.has(c.work_order_id)) constatsByOS.set(c.work_order_id, []);
    constatsByOS.get(c.work_order_id).push(c);
  });
  const acceptedPriority = { "Payé": 3, "Validé avec réserve": 2, "Validé": 1 };
  const forecastStatuses = ["Brouillon", "À vérifier", "À valider"];
  const selectConstats = (workOrderId) => {
    const list = constatsByOS.get(workOrderId) || [];
    const accepted = list
      .filter((c) => Object.prototype.hasOwnProperty.call(acceptedPriority, c.status))
      .sort((a, b) => (acceptedPriority[b.status] - acceptedPriority[a.status]) || String(b.validated_at || b.created_at || "").localeCompare(String(a.validated_at || a.created_at || "")))[0] || null;
    const forecast = list
      .filter((c) => forecastStatuses.includes(c.status))
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] || null;
    return { accepted, forecast };
  };'''
if old_constats in s:
    s = s.replace(old_constats, new_constats, 1)

old_c = '    const c = latestConstatByOS.get(o.id);'
new_c = '    const { accepted: c, forecast: forecastConstat } = selectConstats(o.id);'
if old_c in s:
    s = s.replace(old_c, new_c, 1)

old_ca = '    const ca = num(c?.total_amount);'
new_ca = '''    // SETOM: only accepted/paid constats count as real CA. Brouillon remains forecast-only.
    const constatStatus = c?.status || "—";
    const acceptedCa = c ? num(c.total_amount) : 0;
    const forecastCa = forecastConstat ? num(forecastConstat.total_amount) : 0;
    const ca = acceptedCa;'''
if old_ca in s and 'const acceptedCa =' not in s:
    s = s.replace(old_ca, new_ca, 1)

old_return = '    return { id: o.id, osNumber: o.os_number, status: o.status, date, plannedSurface: num(i?.planned_surface_m2 || o.planned_surface_m2), actualSurface: actualSurface || num(i?.actual_surface_m2), ca, materialCost, laborCost, directOtherCost, directCost, margin, marginPct, consumedTonnes, constatStatus: c?.status || "—" };'
new_return = '    return { id: o.id, osNumber: o.os_number, status: o.status, date, plannedSurface: num(i?.planned_surface_m2 || o.planned_surface_m2), actualSurface: actualSurface || num(i?.actual_surface_m2), ca, forecastCa, materialCost, laborCost, directOtherCost, directCost, margin, marginPct, consumedTonnes, constatStatus };'
if old_return in s:
    s = s.replace(old_return, new_return, 1)

marker = '// SETOM: profitability rules applied'
if marker not in s:
    s += '\n' + marker + '\n'

p.write_text(s, encoding="utf-8")
