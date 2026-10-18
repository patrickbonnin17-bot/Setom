from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[1]
pkg = json.loads((root / "package.json").read_text(encoding="utf-8"))
script = pkg.get("scripts", {}).get("build", "")
required = [
    "patch_dashboard_cockpit.py",
    "patch_dashboard_intelligence.py",
    "patch_staffing_intelligence.py",
    "patch_chargement_material_rules.py",
    "patch_chargement_planning_date.py",
    "patch_chargement_order_context.py",
    "patch_travaux_measurements_photos.py",
    "patch_travaux_material_zero.py",
    "patch_profitability_material_variance.py",
    "patch_profitability_cost_breakdown.py",
    "patch_material_ledger.py",
    "patch_material_ledger_observer.py",
]
missing = [x for x in required if x not in script]
if missing:
    raise SystemExit("SETOM audit: missing build patches: " + ", ".join(missing))

for name in required:
    path = root / "scripts" / name
    if not path.exists():
        raise SystemExit(f"SETOM audit: missing script file {name}")

observer = (root / "scripts" / "patch_material_ledger_observer.py").read_text(encoding="utf-8")
if "already mutation-safe" not in observer and "let mountedRoot" not in observer:
    raise SystemExit("SETOM audit: material ledger observer is not idempotent")

rot = (root / "scripts" / "patch_chargement_material_rules.py").read_text(encoding="utf-8")
for marker in ["materialInfo", "forcedMix", "mixedMaterials"]:
    if marker not in rot:
        raise SystemExit(f"SETOM audit: loading material rule marker missing: {marker}")

print("SETOM audit: build chain, loading rules and ledger observer are structurally present")
