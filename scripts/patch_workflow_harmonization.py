from pathlib import Path
import re

MAIN = Path("src/main.jsx")
PLANNING = Path("src/planningOverlay.jsx")
CONSTATS = Path("src/constatValidationPatch.jsx")

EDITABLE = [
    "Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours",
    "Travaux réalisés", "Travaux effectués", "Constat à vérifier",
    "Constat de facturation", "En attente de validation", "En erreur"
]

s = MAIN.read_text(encoding="utf-8")

# One canonical editable OS policy. This pass runs after all feature patches.
canonical = 'const EDITABLE_OS_STATUSES = [' + ', '.join('"' + x.replace('"', '\\"') + '"' for x in EDITABLE) + '];'
pattern = re.compile(r'const EDITABLE_OS_STATUSES\s*=\s*\[[^;]*\];')
if pattern.search(s):
    s = pattern.sub(canonical, s, count=1)
else:
    anchor = 'const statuses = ['
    if anchor not in s:
        raise SystemExit("SETOM: status catalogue anchor not found")
    s = s.replace(anchor, canonical + "\n\n" + anchor, 1)

# Known legacy guards: operational work includes both spellings used in the database.
for old in [
    '["Planifié", "Travaux en cours", "Travaux réalisés"]',
    '["Planifié","Travaux en cours","Travaux réalisés"]',
    '["Planifié", "Travaux en cours"]',
    '["Planifié","Travaux en cours"]',
]:
    s = s.replace(old, old.replace('"Travaux en cours"', '"En travaux", "Travaux en cours"'))

MAIN.write_text(s, encoding="utf-8")

if PLANNING.exists():
    p = PLANNING.read_text(encoding="utf-8")
    if 'const STATUS_ACTIVE_WORK = ["En travaux", "Travaux en cours"];' not in p:
        anchor = 'const STATUS_PLANIFIABLE = ["À planifier", "Planifié"];'
        if anchor in p:
            p = p.replace(anchor, anchor + '\nconst STATUS_ACTIVE_WORK = ["En travaux", "Travaux en cours"];', 1)
    p = p.replace('order.status === "Travaux en cours"', 'STATUS_ACTIVE_WORK.includes(order.status)')
    PLANNING.write_text(p, encoding="utf-8")

if CONSTATS.exists():
    c = CONSTATS.read_text(encoding="utf-8")
    c = c.replace(
        'if (constat.status !== "À vérifier") {',
        'if (!["Brouillon", "À vérifier", "À valider"].includes(constat.status)) {'
    )
    CONSTATS.write_text(c, encoding="utf-8")

print("SETOM: final workflow harmonization applied")
