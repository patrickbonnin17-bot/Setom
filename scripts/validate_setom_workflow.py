from pathlib import Path
import re
import sys

ROOT = Path("src")

CANONICAL = {
    "planning": ["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "Travaux réalisés", "Travaux effectués", "En erreur"],
    "billing_review": ["Brouillon", "À vérifier", "À valider"],
    "validated": ["Validé", "Validé avec réserve"],
    "closed": ["Payé", "Archivé", "Annulé", "Doublon"],
}

errors = []

main = (ROOT / "main.jsx").read_text(encoding="utf-8")
planning = (ROOT / "planningOverlay.jsx").read_text(encoding="utf-8") if (ROOT / "planningOverlay.jsx").exists() else ""
constat = (ROOT / "constatValidationPatch.jsx").read_text(encoding="utf-8") if (ROOT / "constatValidationPatch.jsx").exists() else ""

# The final build pass must explicitly know both spellings used in existing data.
for status in ("En travaux", "Travaux en cours"):
    if status not in main:
        errors.append(f"main.jsx: missing operational status {status!r}")

# Planning must never use the old single-status guard anymore.
if 'order.status === "Travaux en cours"' in planning:
    errors.append("planningOverlay.jsx: isolated 'Travaux en cours' guard remains")

# Constat validation must accept the complete review chain.
if constat and '["Brouillon", "À vérifier", "À valider"]' not in constat and "['Brouillon', 'À vérifier', 'À valider']" not in constat:
    errors.append("constatValidationPatch.jsx: review chain is not harmonized")

# Closed financial states must not be treated as editable work states.
editable_match = re.search(r'const EDITABLE_OS_STATUSES\s*=\s*\[([^\]]+)\]', main)
if editable_match:
    editable = set(re.findall(r'"([^"]+)"', editable_match.group(1)))
    for status in CANONICAL["closed"]:
        if status in editable:
            errors.append(f"main.jsx: closed status {status!r} is incorrectly editable")
else:
    errors.append("main.jsx: EDITABLE_OS_STATUSES declaration missing")

# Basic invariant: validated/paid statuses must exist in the application status catalogue.
for status in CANONICAL["validated"] + CANONICAL["closed"]:
    if f'"{status}"' not in main:
        errors.append(f"main.jsx: status catalogue missing {status!r}")

# Detect accidental duplicate canonical status declarations in the same source file.
for path in [ROOT / "main.jsx", ROOT / "planningOverlay.jsx", ROOT / "constatValidationPatch.jsx"]:
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    if text.count('const STATUS_ACTIVE_WORK =') > 1:
        errors.append(f"{path}: duplicate STATUS_ACTIVE_WORK declaration")

if errors:
    print("SETOM workflow validation FAILED")
    for error in errors:
        print(" -", error)
    sys.exit(1)

print("SETOM workflow validation OK")
print(" - planning/work states: harmonized")
print(" - constat review states: harmonized")
print(" - validated/closed states: protected")
print(" - duplicate active-work guards: checked")
