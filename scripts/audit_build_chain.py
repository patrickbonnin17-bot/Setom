from pathlib import Path
import json

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
    if not (root / "scripts" / name).exists():
        raise SystemExit(f"SETOM audit: missing script file {name}")

observer = (root / "scripts" / "patch_material_ledger_observer.py").read_text(encoding="utf-8")
if "let mountedRoot" not in observer or "refreshInFlight" not in observer:
    raise SystemExit("SETOM audit: material ledger observer is not mutation-safe/idempotent")

rot = (root / "scripts" / "patch_chargement_material_rules.py").read_text(encoding="utf-8")
for marker in ["materialInfo", "mixedMaterials", "MÉLANGE FORCÉ", "single-material"]:
    if marker not in rot:
        raise SystemExit(f"SETOM audit: loading material rule marker missing: {marker}")

print("SETOM audit: build chain, loading rules and ledger observer are structurally present")
