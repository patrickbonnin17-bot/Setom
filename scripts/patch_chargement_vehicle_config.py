from pathlib import Path

path = Path("src/chargementRotations.js")
text = path.read_text()

marker = 'const DEFAULT_PAYLOAD_T = 7;\n'
bridge = '''const DEFAULT_PAYLOAD_T = 7;\n\n// Central vehicle bridge: keeps Chargement synchronized with the rest of SETOM.\nlet runtimeVehicleConfig = null;\nfunction applyVehicleConfig(value) {\n  if (!value || typeof value !== "object") return;\n  runtimeVehicleConfig = value;\n  // The vehicle can be changed from another SETOM screen while Chargement is open.\n  // Re-render immediately so capacity, rotations and tonnage indicators stay accurate.\n  try { schedule(); } catch (_) {}\n}\ntry {\n  window.addEventListener("setom:vehicle-config", (event) => applyVehicleConfig(event?.detail));\n  window.addEventListener("storage", (event) => {\n    if (event.key === VEHICLE_KEY && event.newValue) {\n      try { applyVehicleConfig(JSON.parse(event.newValue)); } catch (_) {}\n    }\n  });\n} catch (_) {}\n'''
if 'Central vehicle bridge:' not in text:
    if marker not in text:
        raise SystemExit('SETOM vehicle config marker not found; refusing to patch')
    text = text.replace(marker, bridge, 1)

old = '''function readVehiclePayload() {\n  const candidates = [\n    "setom:vehicle:config:v1",\n    "setom:vehicle-config",\n    "setom:truck-config",\n    "setom:chargement:vehicle",\n  ];\n'''
new = '''function readVehiclePayload() {\n  const runtimePayload = num(runtimeVehicleConfig?.payload_t ?? runtimeVehicleConfig?.payloadT ?? runtimeVehicleConfig?.charge_utile_t ?? runtimeVehicleConfig?.chargeUtileT ?? runtimeVehicleConfig?.maxPayloadT ?? runtimeVehicleConfig?.capacity_t);\n  if (runtimePayload > 0) return runtimePayload;\n  const candidates = [\n    VEHICLE_KEY,\n    "setom:vehicle-config",\n    "setom:truck-config",\n    "setom:chargement:vehicle",\n  ];\n'''
if old in text:
    text = text.replace(old, new, 1)
elif 'const runtimePayload = num(runtimeVehicleConfig?' not in text:
    raise SystemExit('readVehiclePayload target not found; refusing to patch')

path.write_text(text)
print('SETOM: Chargement vehicle configuration bridge injected')
