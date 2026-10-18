from pathlib import Path

path = Path("src/chargementRealConsumptionOverlay.js")
s = path.read_text(encoding="utf-8")

# Keep the existing arithmetic, but make its meaning explicit: loaded minus
# consumed is an allocated remainder, not a sensor-confirmed physical stock.
s = s.replace(
    'remainingInTruck: round2(Math.max(0, item.loaded - item.consumed)),',
    'remainingInTruck: round2(Math.max(0, item.loaded - item.consumed)),\n    remainingInTruckType: "reste_affecte",',
    1,
)
s = s.replace(
    '<span>${totalInTruck.toFixed(2)} t restant chargé</span>',
    '<span>${totalInTruck.toFixed(2)} t reste affecté</span>',
    1,
)
s = s.replace(
    '<span>Restant chargé <b>${item.remainingInTruck.toFixed(2)} t</b></span>',
    '<span>Reste affecté <b>${item.remainingInTruck.toFixed(2)} t</b></span>',
    1,
)
s = s.replace(
    '<div><strong>Pilotage réel par OS</strong><small>Prévu → chargé → consommé · ${esc(date)}</small></div>',
    '<div><strong>Pilotage réel par OS</strong><small>Prévu → chargé → consommé · ${esc(date)} · le reste affecté n’est pas un stock physique capteur</small></div>',
    1,
)

# Make the material split visible in the pilot: one OS can legitimately have
# several material consumption records, and SETOM must not collapse them.
needle = 'const byOrder = [...orderMapTotals.values()].map((item) => ({'
if needle in s and 'materialCount' not in s:
    s = s.replace(
        needle,
        'const byOrder = [...orderMapTotals.values()].map((item) => ({\n    materialCount: item.materials.size,',
        1,
    )

path.write_text(s, encoding="utf-8")
print("SETOM: consumption pilot now distinguishes allocated remainder from physical truck stock and preserves material detail")
