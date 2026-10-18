from pathlib import Path

MAIN = Path("src/main.jsx")
PLANNING = Path("src/planningOverlay.jsx")
CONSTATS = Path("src/constatValidationPatch.jsx")

EDITABLE = '["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "Travaux réalisés", "Travaux effectués", "Constat à vérifier", "Constat de facturation", "En attente de validation", "En erreur"]'

s = MAIN.read_text(encoding="utf-8")
# Final pass: normalize guards after all other build-time patches. Safe to run more than once.
s = s.replace('const EDITABLE_OS_STATUSES = ["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "Travaux réalisés", "Travaux effectués", "Constat à vérifier", "Constat de facturation", "En attente de validation", "En erreur"];', 'const EDITABLE_OS_STATUSES = ' + EDITABLE + ';')
for old in [
    '["Planifié", "Travaux en cours", "Travaux réalisés"]',
    '["Planifié","Travaux en cours","Travaux réalisés"]',
    '["Planifié", "Travaux en cours"]',
    '["Planifié","Travaux en cours"]',
]:
    new = old.replace('"Travaux en cours"', '"En travaux", "Travaux en cours"')
    s = s.replace(old, new)
MAIN.write_text(s, encoding="utf-8")

p = PLANNING.read_text(encoding="utf-8")
if 'const STATUS_ACTIVE_WORK = ["En travaux", "Travaux en cours"];' not in p:
    p = p.replace('const STATUS_PLANIFIABLE = ["À planifier", "Planifié"];', 'const STATUS_PLANIFIABLE = ["À planifier", "Planifié"];\nconst STATUS_ACTIVE_WORK = ["En travaux", "Travaux en cours"];')
p = p.replace('order.status === "Travaux en cours"', 'STATUS_ACTIVE_WORK.includes(order.status)')
PLANNING.write_text(p, encoding="utf-8")

if CONSTATS.exists():
    c = CONSTATS.read_text(encoding="utf-8")
    c = c.replace('if (constat.status !== "À vérifier") {', 'if (!["Brouillon", "À vérifier", "À valider"].includes(constat.status)) {')
    CONSTATS.write_text(c, encoding="utf-8")

print("SETOM: workflow guards harmonized")
