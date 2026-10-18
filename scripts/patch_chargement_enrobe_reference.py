from pathlib import Path

# The Chargement module now owns its material reference constants directly.
# Keep this build step as a compatibility no-op so the legacy patch pipeline
# does not rewrite the new interface or fail when its old markers disappear.
path = Path("src/chargementNavigation.js")
if not path.exists():
    raise SystemExit("SETOM: chargementNavigation.js missing")
print("SETOM: Chargement enrobé reference kept in module")
