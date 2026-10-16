from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# Normalize every status guard used by the active OS / Travaux workflow.
# Keep this build-time safety net until the large main.jsx file is cleaned up
# into smaller workflow modules.
replacements = {
    '["Planifié","Travaux en cours","Travaux réalisés"]': '["Planifié","En travaux","Travaux en cours","Travaux réalisés"]',
    '["Planifié", "Travaux en cours", "Travaux réalisés"]': '["Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"]',
    '["Nouveau", "À planifier", "Planifié", "Travaux en cours", "En erreur"]': '["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "En erreur"]',
    '["À planifier", "Planifié", "Travaux en cours", "En erreur"]': '["À planifier", "Planifié", "En travaux", "Travaux en cours", "En erreur"]',
}

for old, new in replacements.items():
    text = text.replace(old, new)

# An OS remains editable by the planning office until it reaches a validation
# state. Once validated, paid, archived or cancelled, the OS is intentionally
# frozen and subsequent corrections belong to the reserve/constat workflow.
editable_status_guard = '["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "En erreur"]'
editable_statuses = '["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "Travaux réalisés", "Travaux effectués", "Constat à vérifier", "Constat de facturation", "En attente de validation", "En erreur"]'
text = text.replace(editable_status_guard, 'EDITABLE_OS_STATUSES')
status_anchor = 'const statuses = ['
if 'const EDITABLE_OS_STATUSES = ' not in text:
    if status_anchor not in text:
        raise SystemExit("SETOM: status declaration anchor not found")
    text = text.replace(status_anchor, 'const EDITABLE_OS_STATUSES = ' + editable_statuses + ';\n\n' + status_anchor, 1)

# When an OS address is changed, invalidate its stored coordinates. The safe
# startup geocoder will then resolve the new address and save fresh coordinates.
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

# Notify the automatic geocoder after a newly-created OS as well as after edits.
create_end_anchor = '''    setNewOSRehabilitationZone(""); setNewOSRehabilitationOtherDetail(""); setNewOSRoadSurface(""); setNewOSSidewalkSurface(""); setNewOSParticularities(""); setNewOSFiles([]); setNewOSError(""); setNewOSSaving(false);\n  }'''
create_end_replacement = '''    setNewOSRehabilitationZone(""); setNewOSRehabilitationOtherDetail(""); setNewOSRoadSurface(""); setNewOSSidewalkSurface(""); setNewOSParticularities(""); setNewOSFiles([]); setNewOSError(""); setNewOSSaving(false);\n    window.dispatchEvent(new CustomEvent("setom:os-created", { detail: { workOrderId: data.id } }));\n  }'''
if create_end_anchor not in text:
    raise SystemExit("SETOM: OS creation completion anchor not found")
text = text.replace(create_end_anchor, create_end_replacement, 1)

# Automatic planning constraints: preserve the material/team m² capacity while
# limiting the total number of OS assigned to a calendar day. This avoids
# creating an itinerary with too many stops even when the m² capacity allows it.
planning_path = Path("src/planningOverlay.jsx")
planning_text = planning_path.read_text(encoding="utf-8")
planning_replacements = {
    '      const dayOrders = new Map();': '      const dayOrders = new Map();\n      const dayCounts = new Map();',
    '        if (!order.planned_date) continue;\n        const nextOrder = Math.max(Number(dayOrders.get(order.planned_date) || 0), Number(order.planned_order || 0));': '        if (!order.planned_date) continue;\n        dayCounts.set(order.planned_date, Number(dayCounts.get(order.planned_date) || 0) + 1);\n        const nextOrder = Math.max(Number(dayOrders.get(order.planned_date) || 0), Number(order.planned_order || 0));',
    '            const used = Number(loads.get(key) || 0);\n            const fits = effortShare <= 1 && used + effortShare <= 1;': '            const used = Number(loads.get(key) || 0);\n            const dayCount = Number(dayCounts.get(candidateDate) || 0);\n            const fits = dayCount < 15 && effortShare <= 1 && used + effortShare <= 1;',
    '          dayOrders.set(candidateDate, position);\n        }': '          dayOrders.set(candidateDate, position);\n          dayCounts.set(candidateDate, Number(dayCounts.get(candidateDate) || 0) + 1);\n        }',
    '    const queue = orders\n      .filter((order) => STATUS_PLANIFIABLE.includes(order.status) && !order.planned_date && (!order.intervention_status || ["À planifier", "Planifié"].includes(order.intervention_status)))\n      .sort((a, b) => String(a.deadline_date || "9999-12-31").localeCompare(String(b.deadline_date || "9999-12-31")) || String(a.sector_name || "").localeCompare(String(b.sector_name || ""), "fr") || a.os_number - b.os_number);': '    const cityCenters = new Map();\n    for (const order of orders) {\n      const city = String(order.city || "").trim().toLocaleLowerCase("fr-FR");\n      const latitude = Number(order.latitude);\n      const longitude = Number(order.longitude);\n      if (!city || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;\n      const current = cityCenters.get(city) || { lat: 0, lon: 0, count: 0 };\n      current.lat += latitude; current.lon += longitude; current.count += 1;\n      cityCenters.set(city, current);\n    }\n    for (const [city, center] of cityCenters) cityCenters.set(city, { lat: center.lat / center.count, lon: center.lon / center.count });\n    const distanceKm = (a, b) => {\n      const lat1 = Number(a?.latitude), lon1 = Number(a?.longitude), lat2 = Number(b?.latitude), lon2 = Number(b?.longitude);\n      if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;\n      const rad = Math.PI / 180;\n      const dLat = (lat2 - lat1) * rad;\n      const dLon = (lon2 - lon1) * rad;\n      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;\n      return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));\n    };\n    const distanceFromCityCenter = (order) => {\n      const city = String(order.city || "").trim().toLocaleLowerCase("fr-FR");\n      const center = cityCenters.get(city);\n      const lat = Number(order.latitude);\n      const lon = Number(order.longitude);\n      if (!center || !Number.isFinite(lat) || !Number.isFinite(lon)) return 0;\n      const dx = (lon - center.lon) * Math.cos(center.lat * Math.PI / 180);\n      const dy = lat - center.lat;\n      return Math.sqrt(dx * dx + dy * dy);\n    };\n    const queue = orders\n      .filter((order) => STATUS_PLANIFIABLE.includes(order.status) && !order.planned_date && (!order.intervention_status || ["À planifier", "Planifié"].includes(order.intervention_status)))\n      .sort((a, b) => String(a.deadline_date || "9999-12-31").localeCompare(String(b.deadline_date || "9999-12-31")) || String(a.sector_name || "").localeCompare(String(b.sector_name || ""), "fr") || String(a.city || "").localeCompare(String(b.city || ""), "fr") || distanceFromCityCenter(b) - distanceFromCityCenter(a) || a.os_number - b.os_number);',
    'Les journées sont réparties du lundi au vendredi selon les secteurs et les capacités des équipes.': 'Les journées sont réparties du lundi au vendredi selon les secteurs, les capacités m² des équipes, une limite de 15 OS par jour et un ordre de tournée privilégiant les points périphériques avant le centre-ville.',
}
for old, new in planning_replacements.items():
    if old not in planning_text:
        raise SystemExit("SETOM: automatic planning pattern not found: " + old[:80])
    planning_text = planning_text.replace(old, new, 1)

route_block = '''      const queueById = new Map(queue.map((order) => [order.id, order]));\n      const assignmentsByDay = new Map();\n      for (const assignment of assignments) {\n        if (!assignmentsByDay.has(assignment.planned_date)) assignmentsByDay.set(assignment.planned_date, []);\n        assignmentsByDay.get(assignment.planned_date).push(assignment);\n      }\n      for (const [date, dayAssignments] of assignmentsByDay) {\n        const remaining = [...dayAssignments];\n        const ordered = [];\n        while (remaining.length) {\n          let nextIndex = 0;\n          if (ordered.length === 0) {\n            let bestScore = Number.NEGATIVE_INFINITY;\n            remaining.forEach((assignment, index) => {\n              const order = queueById.get(assignment.work_order_id);\n              const score = distanceFromCityCenter(order);\n              if (score > bestScore) { bestScore = score; nextIndex = index; }\n            });\n          } else {\n            const previous = queueById.get(ordered[ordered.length - 1].work_order_id);\n            let bestDistance = Number.POSITIVE_INFINITY;\n            remaining.forEach((assignment, index) => {\n              const order = queueById.get(assignment.work_order_id);\n              const distance = distanceKm(previous, order);\n              if (distance < bestDistance) { bestDistance = distance; nextIndex = index; }\n            });\n          }\n          ordered.push(remaining.splice(nextIndex, 1)[0]);\n        }\n        ordered.forEach((assignment, index) => { assignment.planned_order = index + 1; });\n      }\n'''
anchor = '      const lateAssignments = assignments.filter((assignment) => {'
if anchor not in planning_text:
    raise SystemExit("SETOM: late-assignment anchor not found")
planning_text = planning_text.replace(anchor, route_block + anchor, 1)
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
print("SETOM: En travaux enabled across OS editing, issue reporting and work transmission guards")
print("SETOM: OS remains editable by planning until validation")
print("SETOM: address edits invalidate coordinates and trigger automatic re-geocoding")
print("SETOM: automatic planning capped at 15 OS per calendar day while preserving m²/team capacity")
print("SETOM: automatic route order uses peripheral-first then nearest-neighbour ordering")
