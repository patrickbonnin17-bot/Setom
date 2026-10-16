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
    'Les journées sont réparties du lundi au vendredi selon les secteurs et les capacités des équipes.': 'Les journées sont réparties du lundi au vendredi selon les secteurs, les capacités m² des équipes et une limite de 15 OS par jour pour limiter les trajets.',
}
for old, new in planning_replacements.items():
    if old not in planning_text:
        raise SystemExit("SETOM: automatic planning pattern not found: " + old[:80])
    planning_text = planning_text.replace(old, new, 1)
planning_path.write_text(planning_text, encoding="utf-8")

# Treat a reintroduced legacy guard as a build failure instead of silently
# shipping a UI where "En travaux" becomes read-only again.
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
print("SETOM: automatic planning capped at 15 OS per calendar day while preserving m²/team capacity")
