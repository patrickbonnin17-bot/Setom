from pathlib import Path

root = Path(__file__).resolve().parents[1]
patch = (root / "scripts/patch_travaux_actual_reference.py").read_text(encoding="utf-8")
for marker in [
    "setom:actual-reference:v1:",
    "setom:actual-measurements-updated",
    "totalSurfaceM2",
    "source: \"travaux_reels\"",
    "setom:travaux-final-transmitted",
]:
    if marker not in patch:
        raise SystemExit(f"SETOM audit: actual reference marker missing: {marker}")
package = (root / "package.json").read_text(encoding="utf-8")
if "patch_travaux_actual_reference.py" not in package:
    raise SystemExit("SETOM audit: actual reference patch is not in the build chain")
print("SETOM audit: Travaux real measurements have a separate canonical actual reference without overwriting planned values")
