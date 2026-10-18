from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "src" / "main.jsx"
SRC = ROOT / "src" / "chargementRealConsumptionOverlay.js"

main = MAIN.read_text(encoding="utf-8")
marker = 'import "./chargementRealConsumptionOverlay";'
bridge_marker = 'import "./operationalIntelligenceBridge";'
if bridge_marker not in main:
    if marker not in main:
        raise SystemExit("operational intelligence: consumption overlay import not found")
    main = main.replace(marker, marker + '\n' + bridge_marker, 1)
MAIN.write_text(main, encoding="utf-8")

src = SRC.read_text(encoding="utf-8")
needle = '''  const totalInTruck = pilot.reduce((s, x) => s + num(x.remainingInTruck), 0);\n'''
addition = needle + '''  const alerts = pilot.flatMap((item) => {\n    const out = [];\n    if (item.consumed > 0 && item.planned > 0 && item.consumed > item.planned * 1.05) {\n      out.push({ orderId: item.orderId, osNumber: item.osNumber, severity: "critical", type: "consumption", message: `Consommation supérieure de ${Math.abs(item.variance).toFixed(2)} t au prévu`, value: item.variance });\n    }\n    if (item.remainingToLoad > 0) {\n      out.push({ orderId: item.orderId, osNumber: item.osNumber, severity: "warning", type: "loading", message: `${item.remainingToLoad.toFixed(2)} t encore à charger`, value: item.remainingToLoad });\n    }\n    return out;\n  }).sort((a, b) => (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1));\n  const state = { date, totalPlanned: round2(totalPlanned), totalLoaded: round2(totalLoaded), totalConsumed: round2(totalConsumed), remainingToLoad: round2(totalToLoad), remainingLoaded: round2(totalInTruck), orderCount: pilot.length, alerts };\n  window.setomOperationalIntelligence = state;\n  window.dispatchEvent(new CustomEvent("setom:operational-intelligence", { detail: state }));\n'''
if 'window.setomOperationalIntelligence = state;' not in src:
    if needle not in src:
        raise SystemExit("operational intelligence: metrics marker not found")
    src = src.replace(needle, addition, 1)
SRC.write_text(src, encoding="utf-8")

# The dashboard bridge is populated by the real-consumption overlay; keep a tiny
# standalone file only as a future extension point and avoid duplicate polling.
print("SETOM: operational intelligence bridge wired")
