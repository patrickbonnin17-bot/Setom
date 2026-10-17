from pathlib import Path

p = Path("src/profitabilityOverlay.js")
s = p.read_text(encoding="utf-8")

# 1) Real material consumption only: estimated rows never enter real cost or tonnage.
old_consumption = '    const osConsumptions = consumptions.filter((x) => x.work_order_id === o.id);'
new_consumption = '''    // SETOM: profitability uses only real material consumption, never estimates.
    const osConsumptions = consumptions.filter((x) => x.work_order_id === o.id && x.estimated !== true);'''
if old_consumption in s and 'SETOM: profitability uses only real material consumption' not in s:
    s = s.replace(old_consumption, new_consumption, 1)

# 2) Select the best accepted constat for real CA while keeping a forecast constat separately.
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

# 3) Add explicit business KPIs: forecast, validated CA, paid/collected CA.
old_totals = '''  const totals = rows.reduce((a, r) => {
    a.ca += r.ca; a.materialCost += r.materialCost; a.laborCost += r.laborCost; a.directOtherCost += r.directOtherCost; a.directCost += r.directCost; a.margin += r.margin; a.tonnes += r.consumedTonnes; a.surface += r.actualSurface; return a;
  }, { ca: 0, materialCost: 0, laborCost: 0, directOtherCost: 0, directCost: 0, margin: 0, tonnes: 0, surface: 0 });'''
new_totals = '''  const totals = rows.reduce((a, r) => {
    a.ca += r.ca; a.forecastCa += r.forecastCa; a.validatedCa += (r.constatStatus === "Validé" || r.constatStatus === "Validé avec réserve") ? r.ca : 0; a.paidCa += r.constatStatus === "Payé" ? r.ca : 0;
    a.materialCost += r.materialCost; a.laborCost += r.laborCost; a.directOtherCost += r.directOtherCost; a.directCost += r.directCost; a.margin += r.margin; a.tonnes += r.consumedTonnes; a.surface += r.actualSurface; return a;
  }, { ca: 0, forecastCa: 0, validatedCa: 0, paidCa: 0, materialCost: 0, laborCost: 0, directOtherCost: 0, directCost: 0, margin: 0, tonnes: 0, surface: 0 });'''
if old_totals in s and 'a.forecastCa' not in s:
    s = s.replace(old_totals, new_totals, 1)

# 4) Make the visible dashboard show the three CA stages before the cost/margin cards.
old_render_totals = '''  const totals = filtered.reduce((a, r) => { a.ca += r.ca; a.material += r.materialCost; a.labor += r.laborCost; a.other += r.directOtherCost; a.cost += r.directCost; a.margin += r.margin; a.tonnes += r.consumedTonnes; a.surface += r.actualSurface; return a; }, { ca: 0, material: 0, labor: 0, other: 0, cost: 0, margin: 0, tonnes: 0, surface: 0 });'''
new_render_totals = '''  const totals = filtered.reduce((a, r) => {
    a.ca += r.ca; a.forecastCa += r.forecastCa; a.validatedCa += (r.constatStatus === "Validé" || r.constatStatus === "Validé avec réserve") ? r.ca : 0; a.paidCa += r.constatStatus === "Payé" ? r.ca : 0;
    a.material += r.materialCost; a.labor += r.laborCost; a.other += r.directOtherCost; a.cost += r.directCost; a.margin += r.margin; a.tonnes += r.consumedTonnes; a.surface += r.actualSurface; return a;
  }, { ca: 0, forecastCa: 0, validatedCa: 0, paidCa: 0, material: 0, labor: 0, other: 0, cost: 0, margin: 0, tonnes: 0, surface: 0 });'''
if old_render_totals in s and 'a.forecastCa' not in s[s.find('function render'):]:
    s = s.replace(old_render_totals, new_render_totals, 1)

old_grid = '''        <div class="pr-grid">
          <div class="pr-card"><div class="pr-label">Chiffre d'affaires</div><div class="pr-value">${euro(totals.ca)}</div></div>
          <div class="pr-card"><div class="pr-label">Coût matériaux</div><div class="pr-value">${euro(totals.material)}</div></div>
          <div class="pr-card"><div class="pr-label">Autres coûts directs</div><div class="pr-value">${euro(totals.other)}</div></div>
          <div class="pr-card"><div class="pr-label">Coût direct total</div><div class="pr-value">${euro(totals.cost)}</div></div>
          <div class="pr-card"><div class="pr-label">Marge brute</div><div class="pr-value ${moneyClass(totals.margin)}">${euro(totals.margin)}${totals.marginPct == null ? "" : ` · ${totals.marginPct.toFixed(1)} %`}</div></div>
        </div>'''
new_grid = '''        <div class="pr-grid">
          <div class="pr-card"><div class="pr-label">🟡 Prévisionnel</div><div class="pr-value">${euro(totals.forecastCa)}</div><div class="pr-note">Constats brouillon / à vérifier / à valider</div></div>
          <div class="pr-card"><div class="pr-label">🟢 CA validé</div><div class="pr-value">${euro(totals.validatedCa)}</div><div class="pr-note">Validé + validé avec réserve</div></div>
          <div class="pr-card"><div class="pr-label">🔵 CA encaissé</div><div class="pr-value">${euro(totals.paidCa)}</div><div class="pr-note">Constats au statut Payé</div></div>
          <div class="pr-card"><div class="pr-label">Coût direct total</div><div class="pr-value">${euro(totals.cost)}</div></div>
          <div class="pr-card"><div class="pr-label">Marge réelle</div><div class="pr-value ${moneyClass(totals.margin)}">${euro(totals.margin)}${totals.marginPct == null ? "" : ` · ${totals.marginPct.toFixed(1)} %`}</div><div class="pr-note">Sur CA accepté uniquement</div></div>
        </div>
        <div class="pr-grid">
          <div class="pr-card"><div class="pr-label">Coût matériaux</div><div class="pr-value">${euro(totals.material)}</div></div>
          <div class="pr-card"><div class="pr-label">Autres coûts directs</div><div class="pr-value">${euro(totals.other)}</div></div>
          <div class="pr-card"><div class="pr-label">Chiffre d'affaires accepté</div><div class="pr-value">${euro(totals.ca)}</div></div>
          <div class="pr-card"><div class="pr-label">Surface réalisée</div><div class="pr-value">${num(totals.surface).toFixed(1)} m²</div></div>
          <div class="pr-card"><div class="pr-label">Tonnage consommé</div><div class="pr-value">${tonnes(totals.tonnes)}</div></div>
        </div>'''
if old_grid in s and '🟡 Prévisionnel' not in s:
    s = s.replace(old_grid, new_grid, 1)

marker = '// SETOM: profitability rules applied'
if marker not in s:
    s += '\n' + marker + '\n'

p.write_text(s, encoding="utf-8")
