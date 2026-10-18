from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
imp = 'import "./chargementMaterialLedger";\n'
if imp not in text:
    text = imp + text
    path.write_text(text, encoding="utf-8")

pkg = Path("package.json")
data = pkg.read_text(encoding="utf-8")
needle = "python3 scripts/patch_chargement_consumption_truth.py &&"
insert = "python3 scripts/patch_material_ledger.py && "
if "patch_material_ledger.py" not in data:
    data = data.replace(needle, insert + needle, 1)
    pkg.write_text(data, encoding="utf-8")
print("SETOM: daily material ledger mounted")
