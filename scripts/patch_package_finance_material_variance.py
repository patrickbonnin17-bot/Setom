from pathlib import Path
import json

p = Path("package.json")
data = json.loads(p.read_text(encoding="utf-8"))
build = data.get("scripts", {}).get("build", "")
for patch in [
    "scripts/patch_material_ledger_observer.py",
    "scripts/patch_profitability_material_variance.py",
]:
    cmd = f"python3 {patch}"
    if cmd not in build:
        build += f" && {cmd}"
data.setdefault("scripts", {})["build"] = build
p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("SETOM: finance/material patches added to build chain")
