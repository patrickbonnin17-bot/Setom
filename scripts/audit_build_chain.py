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
    "patch_planning_daily_team.py",
    "patch_constat_rpc_safety.py",
    "patch_constat_validation_status.py",
    "patch_travaux_draft.py",
    "patch_travaux_draft_safety.py",
    "patch_travaux_final_guard.py",
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
for marker in [
    "materialInfo",
    "byMaterial",
    "mixedMaterials",
    "MÉLANGE FORCÉ",
    "Material change always starts a fresh rotation.",
    "assignments[copy.id] = rotation",
]:
    if marker not in rot:
        raise SystemExit(f"SETOM audit: loading rotation invariant missing: {marker}")

forced = (root / "scripts" / "patch_chargement_forced_mix_guard.py").read_text(encoding="utf-8")
for marker in [
    "createsForcedMix",
    "forcedMixes",
    "manual multi-material assignment",
    "state.forcedMixes = { ...(state.forcedMixes || {}) }",
    "if (createsForcedMix) state.forcedMixes[target] = true;",
    "if (createsForcedMix) toast",
]:
    if marker not in forced:
        raise SystemExit(f"SETOM audit: forced-mix control marker missing: {marker}")
if "function setAssignment(id, rotation)" not in forced:
    raise SystemExit("SETOM audit: manual assignment function is missing")

if "function autoDistribute(plan)" not in rot or "for (const [material, group] of byMaterial.entries())" not in rot:
    raise SystemExit("SETOM audit: automatic loading distribution is not grouped by material")

date_patch = (root / "scripts" / "patch_chargement_planning_date.py").read_text(encoding="utf-8")
for marker in ["setom:chargement:date:v1", "selectedDate = ()", "setom:chargement-date-changed"]:
    if marker not in date_patch:
        raise SystemExit(f"SETOM audit: planning/loading date bridge marker missing: {marker}")

bridge = (root / "scripts" / "patch_planning_chargement_bridge.py").read_text(encoding="utf-8")
for marker in [
    "SETOM_PLANNING_TONNAGE_KEY",
    "syncPlanningToChargement",
    "setom:chargement-updated",
    "loaded: Math.max(0, Number(existing?.loaded || 0))",
    "Cette valeur alimente directement les rotations du camion.",
]:
    if marker not in bridge:
        raise SystemExit(f"SETOM audit: planning/loading bridge invariant missing: {marker}")
if "value === \"\" ? 0 : Math.max(0, Number(value))" not in bridge:
    raise SystemExit("SETOM audit: planning tonnage input is not normalized safely")

team = (root / "scripts" / "patch_planning_daily_team.py").read_text(encoding="utf-8")
for marker in [
    "destinationTeamIds",
    "effectiveDayTeamId",
    "Équipe unique de la journée",
    "dayTeam = new Map()",
    "team_id: teamId",
]:
    if marker not in team:
        raise SystemExit(f"SETOM audit: daily team planning marker missing: {marker}")
if "plannedIds" not in team or ".in(\"id\", plannedIds)" not in team:
    raise SystemExit("SETOM audit: daily team adaptation does not update the whole day")

consumption = (root / "scripts" / "patch_chargement_consumption_truth.py").read_text(encoding="utf-8")
for marker in ["remainingInTruckType: \"reste_affecte\"", "Reste affecté", "n’est pas un stock physique capteur"]:
    if marker not in consumption:
        raise SystemExit(f"SETOM audit: consumption truth marker missing: {marker}")

constat = (root / "scripts" / "patch_constat_rpc_safety.py").read_text(encoding="utf-8")
for marker in ["get_constat_for_work_order", "unsupported regenerate_constat_for_work_order RPC remains"]:
    if marker not in constat:
        raise SystemExit(f"SETOM audit: constat safety guard marker missing: {marker}")

travaux = (root / "scripts" / "patch_travaux_measurements_photos.py").read_text(encoding="utf-8")
for marker in ["data-setom-travaux-photo-zone", "capture=\"environment\"", "Mesures réelles", "totalSurface"]:
    if marker not in travaux:
        raise SystemExit(f"SETOM audit: Travaux measurement/photo marker missing: {marker}")

draft = (root / "scripts" / "patch_travaux_draft.py").read_text(encoding="utf-8")
for marker in ["async function saveWorkDraft()", "Enregistrer les mesures", "Brouillon des travaux enregistré"]:
    if marker not in draft:
        raise SystemExit(f"SETOM audit: Travaux draft marker missing: {marker}")

draft_safety = (root / "scripts" / "patch_travaux_draft_safety.py").read_text(encoding="utf-8")
for marker in ["must not gate the measurement draft itself", "work_realizations", "Travaux drafts now persist measurements independently of photos"]:
    if marker not in draft_safety:
        raise SystemExit(f"SETOM audit: Travaux draft safety marker missing: {marker}")

final_guard = (root / "scripts" / "patch_travaux_final_guard.py").read_text(encoding="utf-8")
for marker in ["final transmission", "[\"Planifié\",\"En travaux\",\"Travaux en cours\",\"Travaux réalisés\"]", "SETOM: final Travaux transmission guard applied"]:
    if marker not in final_guard:
        raise SystemExit(f"SETOM audit: Travaux final transmission guard marker missing: {marker}")

validation = (root / "scripts" / "patch_constat_validation_status.py").read_text(encoding="utf-8")
if "[\"Brouillon\", \"À vérifier\", \"À valider\"]" not in validation:
    raise SystemExit("SETOM audit: constat validation status guard is incomplete")

staffing = (root / "src" / "staffingIntelligence.js").read_text(encoding="utf-8")
for marker in ["DEFAULT_TEAM_SIZE = 6", "jamais OS par OS"]:
    if marker not in staffing:
        raise SystemExit(f"SETOM audit: staffing rule marker missing: {marker}")

variance = (root / "scripts/patch_profitability_material_variance.py").read_text(encoding="utf-8")
if "materialQuantityVariance" not in variance or "Écart matière" not in variance:
    raise SystemExit("SETOM audit: profitability material variance patch is incomplete")

costs = (root / "scripts/patch_profitability_cost_breakdown.py").read_text(encoding="utf-8")
if "laborCost" not in costs or "directOtherCost" not in costs:
    raise SystemExit("SETOM audit: profitability cost breakdown is incomplete")

print("SETOM audit: build chain, material-separated rotations, forced-mix control, planning/loading preservation, daily team rule, consumption truth, Travaux draft/transmission/capture, constat safety/validation, staffing, material ledger and profitability invariants are structurally present")
