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
    "patch_chargement_forced_mix_guard.py",
    "patch_chargement_planning_date.py",
    "patch_chargement_order_context.py",
    "patch_planning_chargement_bridge.py",
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
for marker in ["materialInfo", "mixedMaterials", "MÉLANGE FORCÉ", "Material change always starts a fresh rotation."]:
    if marker not in rot:
        raise SystemExit(f"SETOM audit: loading rotation invariant missing: {marker}")

forced = (root / "scripts" / "patch_chargement_forced_mix_guard.py").read_text(encoding="utf-8")
for marker in ["createsForcedMix", "forcedMixes", "manual multi-material assignment"]:
    if marker not in forced:
        raise SystemExit(f"SETOM audit: forced-mix guard marker missing: {marker}")

date_patch = (root / "scripts" / "patch_chargement_planning_date.py").read_text(encoding="utf-8")
for marker in ["setom:chargement:date:v1", "selectedDate = ()", "setom:chargement-date-changed"]:
    if marker not in date_patch:
        raise SystemExit(f"SETOM audit: planning/loading date bridge marker missing: {marker}")

bridge = (root / "scripts" / "patch_planning_chargement_bridge.py").read_text(encoding="utf-8")
for marker in ["SETOM_PLANNING_TONNAGE_KEY", "syncPlanningToChargement", "setom:chargement-updated"]:
    if marker not in bridge:
        raise SystemExit(f"SETOM audit: planning/loading bridge marker missing: {marker}")

staffing = (root / "src" / "staffingIntelligence.js").read_text(encoding="utf-8")
for marker in ["DEFAULT_TEAM_SIZE = 6", "jamais OS par OS"]:
    if marker not in staffing:
        raise SystemExit(f"SETOM audit: staffing rule marker missing: {marker}")

variance = (root / "scripts" / "patch_profitability_material_variance.py").read_text(encoding="utf-8")
if "materialQuantityVariance" not in variance or "Écart matière" not in variance:
    raise SystemExit("SETOM audit: profitability material variance patch is incomplete")

costs = (root / "scripts" / "patch_profitability_cost_breakdown.py").read_text(encoding="utf-8")
if "laborCost" not in costs or "directOtherCost" not in costs:
    raise SystemExit("SETOM audit: profitability cost breakdown patch is incomplete")

print("SETOM audit: build chain, loading/date bridges, forced-mix control, staffing, material ledger and profitability invariants are structurally present")
