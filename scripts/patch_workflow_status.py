from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# Normalize every status guard used by the active OS / Travaux workflow.
replacements = {
    '["Planifié","Travaux en cours","Travaux réalisés"]': '["Planifié","En travaux","Travaux en cours","Travaux réalisés"]',
    '["Planifié", "Travaux en cours", "Travaux réalisés"]': '["Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"]',
    '["Nouveau", "À planifier", "Planifié", "Travaux en cours", "En erreur"]': '["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "En erreur"]',
    '["À planifier", "Planifié", "Travaux en cours", "En erreur"]': '["À planifier", "Planifié", "En travaux", "Travaux en cours", "En erreur"]',
}
for old, new in replacements.items():
    text = text.replace(old, new)

# Keep OS editing available through the operational phase, until validation.
editable_status_guard = '["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "En erreur"]'
editable_statuses = '["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "Travaux réalisés", "Travaux effectués", "Constat à vérifier", "Constat de facturation", "En attente de validation", "En erreur"]'
text = text.replace(editable_status_guard, 'EDITABLE_OS_STATUSES')
status_anchor = 'const statuses = ['
if 'const EDITABLE_OS_STATUSES = ' not in text:
    if status_anchor not in text:
        raise SystemExit("SETOM: status declaration anchor not found")
    text = text.replace(status_anchor, 'const EDITABLE_OS_STATUSES = ' + editable_statuses + ';\n\n' + status_anchor, 1)

# Invalidate coordinates when the OS address changes so the automatic geocoder resolves it again.
address_edit_anchor = '''    setOsEditSaving(true);\n    try {\n      const payload = {'''
address_edit_replacement = '''    setOsEditSaving(true);\n    try {\n      const currentAddress = String(os?.address || "").trim();\n      const nextAddress = [address, String(osEditDraft.postal_code || "").trim(), String(osEditDraft.city || "").trim()].filter(Boolean).join(", ");\n      const addressChanged = currentAddress !== nextAddress;\n      const payload = {'''
if address_edit_anchor not in text:
    raise SystemExit("SETOM: OS edit payload anchor not found")
text = text.replace(address_edit_anchor, address_edit_replacement, 1)
payload_anchor = '''        particularities: String(osEditDraft.particularities || "").trim() || null,\n        updated_by: user.id,'''
payload_replacement = '''        particularities: String(osEditDraft.particularities || "").trim() || null,\n        ...(addressChanged ? { latitude: null, longitude: null } : {}),\n        updated_by: user.id,'''
if payload_anchor not in text:
    raise SystemExit("SETOM: OS edit payload fields anchor not found")
text = text.replace(payload_anchor, payload_replacement, 1)

# Notify the automatic geocoder after OS creation.
create_end_anchor = '''    setNewOSRehabilitationZone(""); setNewOSRehabilitationOtherDetail(""); setNewOSRoadSurface(""); setNewOSSidewalkSurface(""); setNewOSParticularities(""); setNewOSFiles([]); setNewOSError(""); setNewOSSaving(false);\n  }'''
create_end_replacement = '''    setNewOSRehabilitationZone(""); setNewOSRehabilitationOtherDetail(""); setNewOSRoadSurface(""); setNewOSSidewalkSurface(""); setNewOSParticularities(""); setNewOSFiles([]); setNewOSError(""); setNewOSSaving(false);\n    window.dispatchEvent(new CustomEvent("setom:os-created", { detail: { workOrderId: data.id } }));\n  }'''
if create_end_anchor not in text:
    raise SystemExit("SETOM: OS creation completion anchor not found")
text = text.replace(create_end_anchor, create_end_replacement, 1)

# The free-text material detail field is redundant: the material cards and their precise variants are enough.
text = text.replace('          <label>Détail du matériau</label><input type="text" value={newOSMaterialDetail} onChange={(e) => setNewOSMaterialDetail(e.target.value)} placeholder="Ex. Enrobé 0/10 noir" />\n', '', 1)

planning_path = Path("src/planningOverlay.jsx")
planning_text = planning_path.read_text(encoding="utf-8")

# Keep the automatic planner's hard stop-count and daily-capacity safeguards.
planning_safety_replacements = {
    '      const dayOrders = new Map();': '      const dayOrders = new Map();\\n      const dayCounts = new Map();',
    '        if (!order.planned_date) continue;\\n        const nextOrder = Math.max(Number(dayOrders.get(order.planned_date) || 0), Number(order.planned_order || 0));': '        if (!order.planned_date) continue;\\n        dayCounts.set(order.planned_date, Number(dayCounts.get(order.planned_date) || 0) + 1);\\n        const nextOrder = Math.max(Number(dayOrders.get(order.planned_date) || 0), Number(order.planned_order || 0));',
    '            const used = Number(loads.get(key) || 0);\\n            const fits = effortShare <= 1 && used + effortShare <= 1;': '            const used = Number(loads.get(key) || 0);\\n            const dayCount = Number(dayCounts.get(candidateDate) || 0);\\n            const fits = dayCount < 15 && effortShare <= 1 && used + effortShare <= 1;',
    '          dayOrders.set(candidateDate, position);\\n        }': '          dayOrders.set(candidateDate, position);\\n          dayCounts.set(candidateDate, Number(dayCounts.get(candidateDate) || 0) + 1);\\n        }',
}
for old, new in planning_safety_replacements.items():
    if old not in planning_text:
        raise SystemExit("SETOM: planning safety anchor not found: " + old[:80])
    planning_text = planning_text.replace(old, new, 1)

# Material-day planning is persisted locally for the planning workstation. A day can have one precise material only.
state_anchor = '  const [routeTeamId, setRouteTeamId] = useState("");'
state_replacement = '''  const [routeTeamId, setRouteTeamId] = useState("");\n  const [dayMaterialPlan, setDayMaterialPlan] = useState(() => {\n    try { return JSON.parse(localStorage.getItem("setom-day-material-plan-v1") || "{}"); } catch { return {}; }\n  });'''
if state_anchor not in planning_text:
    raise SystemExit("SETOM: planner state anchor not found")
planning_text = planning_text.replace(state_anchor, state_replacement, 1)

by_date_anchor = '''  const byDate = useMemo(() => {\n    const map = new Map();\n    orders.forEach((o) => { if (o.planned_date) { if (!map.has(o.planned_date)) map.set(o.planned_date, []); map.get(o.planned_date).push(o); } });\n    map.forEach((list) => list.sort((a, b) => (a.planned_order || 0) - (b.planned_order || 0) || a.os_number - b.os_number));\n    return map;\n  }, [orders]);'''
by_date_replacement = '''  const byDate = useMemo(() => {\n    const map = new Map();\n    orders.forEach((o) => { if (o.planned_date) { if (!map.has(o.planned_date)) map.set(o.planned_date, []); map.get(o.planned_date).push(o); } });\n    map.forEach((list) => list.sort((a, b) => (a.planned_order || 0) - (b.planned_order || 0) || a.os_number - b.os_number));\n    return map;\n  }, [orders]);\n\n  const materialOptions = useMemo(() => {\n    const names = plannerMaterials.flatMap((material) => [String(material.category || "").trim(), String(material.name || "").trim()]).filter(Boolean);\n    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "fr"));\n  }, [plannerMaterials]);\n\n  const materialNameForOrder = (order) => {\n    const value = String(order?.material_detail || "").trim();\n    if (!value) return "";\n    const exact = plannerMaterials.find((material) => String(material.name || "").trim().toLocaleLowerCase("fr-FR") === value.toLocaleLowerCase("fr-FR"));\n    if (exact) return String(exact.name).trim();\n    return value;\n  };\n\n  async function setPlanningDayMaterial(date, materialName) {\n    if (!isOffice) return;\n    const nextMaterial = String(materialName || "").trim();\n    const existing = byDate.get(date) || [];\n    if (nextMaterial && existing.some((order) => materialNameForOrder(order) !== nextMaterial)) {\n      setError("Impossible de choisir « " + nextMaterial + " » pour cette journée : des OS d'un autre matériau sont déjà planifiés. Déplacez-les d'abord.");\n      return;\n    }\n    setError("");\n    setDayMaterialPlan((current) => {\n      const next = { ...current };\n      if (nextMaterial) next[date] = nextMaterial; else delete next[date];\n      try { localStorage.setItem("setom-day-material-plan-v1", JSON.stringify(next)); } catch {}\n      return next;\n    });\n  }'''
if by_date_anchor not in planning_text:
    raise SystemExit("SETOM: byDate anchor not found")
planning_text = planning_text.replace(by_date_anchor, by_date_replacement, 1)

# Automatic planning: once a day has a material selected, only matching precise-material OS can be assigned.
queue_anchor = '''    const queue = orders\n      .filter((order) => STATUS_PLANIFIABLE.includes(order.status) && !order.planned_date && (!order.intervention_status || ["À planifier", "Planifié"].includes(order.intervention_status)))\n      .sort((a, b) => String(a.deadline_date || "9999-12-31").localeCompare(String(b.deadline_date || "9999-12-31")) || String(a.sector_name || "").localeCompare(String(b.sector_name || ""), "fr") || a.os_number - b.os_number);'''
queue_replacement = '''    const cityCenters = new Map();\n    for (const order of orders) {\n      const city = String(order.city || "").trim().toLocaleLowerCase("fr-FR");\n      const latitude = Number(order.latitude), longitude = Number(order.longitude);\n      if (!city || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;\n      const current = cityCenters.get(city) || { lat: 0, lon: 0, count: 0 };\n      current.lat += latitude; current.lon += longitude; current.count += 1;\n      cityCenters.set(city, current);\n    }\n    for (const [city, center] of cityCenters) cityCenters.set(city, { lat: center.lat / center.count, lon: center.lon / center.count });\n    const distanceKm = (a, b) => {\n      const lat1 = Number(a?.latitude), lon1 = Number(a?.longitude), lat2 = Number(b?.latitude), lon2 = Number(b?.longitude);\n      if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;\n      const rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;\n      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;\n      return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));\n    };\n    const distanceFromCityCenter = (order) => {\n      const city = String(order.city || "").trim().toLocaleLowerCase("fr-FR");\n      const center = cityCenters.get(city), lat = Number(order.latitude), lon = Number(order.longitude);\n      if (!center || !Number.isFinite(lat) || !Number.isFinite(lon)) return 0;\n      const dx = (lon - center.lon) * Math.cos(center.lat * Math.PI / 180), dy = lat - center.lat;\n      return Math.sqrt(dx * dx + dy * dy);\n    };\n    const queue = orders\n      .filter((order) => STATUS_PLANIFIABLE.includes(order.status) && !order.planned_date && (!order.intervention_status || ["À planifier", "Planifié"].includes(order.intervention_status)))\n      .sort((a, b) => String(a.deadline_date || "9999-12-31").localeCompare(String(b.deadline_date || "9999-12-31")) || materialNameForOrder(a).localeCompare(materialNameForOrder(b), "fr") || String(a.sector_name || "").localeCompare(String(b.sector_name || ""), "fr") || String(a.city || "").localeCompare(String(b.city || ""), "fr") || distanceFromCityCenter(b) - distanceFromCityCenter(a) || a.os_number - b.os_number);'''
if queue_anchor not in planning_text:
    raise SystemExit("SETOM: planning queue anchor not found")
planning_text = planning_text.replace(queue_anchor, queue_replacement, 1)

candidate_anchor = '''            const used = Number(loads.get(key) || 0);\n            const dayCount = Number(dayCounts.get(candidateDate) || 0);\n            const fits = dayCount < 15 && effortShare <= 1 && used + effortShare <= 1;'''
candidate_replacement = '''            const used = Number(loads.get(key) || 0);\n            const dayCount = Number(dayCounts.get(candidateDate) || 0);\n            const selectedMaterial = dayMaterialPlan[candidateDate] || "";\n            const orderMaterial = materialNameForOrder(order);\n            const fitsMaterial = !selectedMaterial || selectedMaterial === orderMaterial;\n            const fits = fitsMaterial && dayCount < 15 && effortShare <= 1 && used + effortShare <= 1;'''
if candidate_anchor not in planning_text:
    raise SystemExit("SETOM: planning candidate anchor not found")
planning_text = planning_text.replace(candidate_anchor, candidate_replacement, 1)

assignment_anchor = '''          assignments.push(selected);\n          loads.set(choice.key, choice.used + choice.effortShare);\n          dayOrders.set(candidateDate, position);\n          dayCounts.set(candidateDate, Number(dayCounts.get(candidateDate) || 0) + 1);'''
assignment_replacement = '''          assignments.push(selected);\n          loads.set(choice.key, choice.used + choice.effortShare);\n          dayOrders.set(candidateDate, position);\n          dayCounts.set(candidateDate, Number(dayCounts.get(candidateDate) || 0) + 1);\n          if (!dayMaterialPlan[candidateDate]) dayMaterialPlan[candidateDate] = materialNameForOrder(order);'''
if assignment_anchor not in planning_text:
    raise SystemExit("SETOM: planning assignment anchor not found")
planning_text = planning_text.replace(assignment_anchor, assignment_replacement, 1)

# Manual planning must respect the selected precise material of the destination day.
plan_order_anchor = '''      const dateKey = date || null;\n      const destinationOrders = dateKey ? (byDate.get(dateKey) || []) : [];'''
plan_order_replacement = '''      const dateKey = date || null;\n      const destinationOrders = dateKey ? (byDate.get(dateKey) || []) : [];\n      const existingMaterial = dateKey ? (destinationOrders.find((item) => item.id !== order.id)?.material_detail || "") : "";\n      const selectedMaterial = dateKey ? String(dayMaterialPlan[dateKey] || materialNameForOrder({ material_detail: existingMaterial }) || "").trim() : "";\n      if (dateKey && selectedMaterial && materialNameForOrder(order) !== selectedMaterial) {\n        setError("Cet OS est « " + materialNameForOrder(order) + " » alors que la journée est dédiée au matériau « " + selectedMaterial + " ». Choisissez une autre journée.");\n        return;\n      }'''
if plan_order_anchor not in planning_text:
    raise SystemExit("SETOM: planOrder anchor not found")
planning_text = planning_text.replace(plan_order_anchor, plan_order_replacement, 1)

# Save the automatically inferred material-day choices after the batch is accepted.
apply_anchor = '''      if (Number(result?.planned_count) !== assignments.length) throw new Error("La base n'a pas confirmé la planification de tous les OS.");\n      window.dispatchEvent(new Event("setom:planning-updated"));'''
apply_replacement = '''      if (Number(result?.planned_count) !== assignments.length) throw new Error("La base n'a pas confirmé la planification de tous les OS.");\n      setDayMaterialPlan((current) => {\n        const next = { ...current, ...dayMaterialPlan };\n        try { localStorage.setItem("setom-day-material-plan-v1", JSON.stringify(next)); } catch {}\n        return next;\n      });\n      window.dispatchEvent(new Event("setom:planning-updated"));'''
if apply_anchor not in planning_text:
    raise SystemExit("SETOM: planning apply anchor not found")
planning_text = planning_text.replace(apply_anchor, apply_replacement, 1)

# Add a compact weekly material selector to the planning toolbar.
toolbar_anchor = '''      </div>\n      <StatusLegend compact />'''
toolbar_replacement = '''      </div>\n      {isOffice && <div className="setom-day-material-strip">\n        <div className="setom-day-material-title"><strong>🧱 Matériau de la journée</strong><span>Un seul matériau précis par jour — les OS d'un autre matériau sont refusés.</span></div>\n        <div className="setom-day-material-grid">{weekCells.slice(0, 5).map((date, index) => {\n          const key = iso(date);\n          return <label key={key} className="setom-day-material-cell" style={{ borderTopColor: DAY_COLORS[index] }}>\n            <strong>{dayNames[index]} {date.getDate()}/{date.getMonth() + 1}</strong>\n            <select value={dayMaterialPlan[key] || ""} onChange={(e) => setPlanningDayMaterial(key, e.target.value)}>\n              <option value="">Tous / à définir</option>\n              {materialOptions.map((material) => <option key={material} value={material}>{material}</option>)}\n            </select>\n          </label>;\n        })}</div>\n      </div>}\n      <StatusLegend compact />'''
if toolbar_anchor not in planning_text:
    raise SystemExit("SETOM: planner toolbar anchor not found")
planning_text = planning_text.replace(toolbar_anchor, toolbar_replacement, 1)

# Show the chosen material directly in the weekly/monthly binder headers.
week_head_anchor = '<strong>{dayNames[i]}</strong><span>{date.getDate()}/{date.getMonth() + 1}</span>'
week_head_replacement = '<strong>{dayNames[i]}</strong><span>{date.getDate()}/{date.getMonth() + 1}</span>{dayMaterialPlan[key] && <small>🧱 {dayMaterialPlan[key]}</small>}'
planning_text = planning_text.replace(week_head_anchor, week_head_replacement, 1)

binder_head_anchor = '<strong>Classeur journalier</strong><span>{new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>'
binder_head_replacement = '<strong>Classeur journalier</strong><span>{new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>{dayMaterialPlan[selectedDate] && <span>🧱 Matériau : {dayMaterialPlan[selectedDate]}</span>}'
planning_text = planning_text.replace(binder_head_anchor, binder_head_replacement, 1)

planning_text = planning_text.replace('<strong>{dayNames[i]}</strong><span>{date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })} · {items.length} OS</span>', '<strong>{dayNames[i]}</strong><span>{date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })} · {items.length} OS</span>{dayMaterialPlan[key] && <small>🧱 {dayMaterialPlan[key]}</small>}', 1)

# Month cells also expose the selected material at a glance.
month_item_anchor = '<div className="setom-month-day"><span>{date.getDate()}</span>{items.length > 0 && <b>{items.length}</b>}</div>'
month_item_replacement = '<div className="setom-month-day"><span>{date.getDate()}</span>{items.length > 0 && <b>{items.length}</b>}</div>{dayMaterialPlan[key] && <small>🧱 {dayMaterialPlan[key]}</small>}'
planning_text = planning_text.replace(month_item_anchor, month_item_replacement, 1)

planning_path.write_text(planning_text, encoding="utf-8")

legacy_guards = [
    '["Planifié","Travaux en cours","Travaux réalisés"]',
    '["Planifié", "Travaux en cours", "Travaux réalisés"]',
    '["Nouveau", "À planifier", "Planifié", "Travaux en cours", "En erreur"]',
    '["À planifier", "Planifié", "Travaux en cours", "En erreur"]',
]
remaining = [guard for guard in legacy_guards if guard in text]
if remaining:
    raise SystemExit("SETOM: legacy workflow status guard detected: " + " | ".join(remaining))

path.write_text(text, encoding="utf-8")
print("SETOM: En travaux enabled across OS workflow guards")
print("SETOM: OS remains editable through validation")
print("SETOM: address edits invalidate coordinates and trigger automatic re-geocoding")
print("SETOM: automatic planning capped at 15 OS per calendar day")
print("SETOM: automatic route order uses peripheral-first then nearest-neighbour ordering")
print("SETOM: planning can dedicate each day to one precise material and prevents mixing")
print("SETOM: free-text material detail field removed from new OS form")
