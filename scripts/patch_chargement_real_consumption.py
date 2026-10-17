from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
imp = 'import "./chargementRealConsumptionOverlay";\n'
if imp not in text:
    text = imp + text
    path.write_text(text, encoding="utf-8")
print("SETOM: Chargement real consumption bridge loaded")
