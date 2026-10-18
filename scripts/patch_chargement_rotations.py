from pathlib import Path

path = Path("src/main.jsx")
s = path.read_text(encoding="utf-8")
needle = 'import "./profitabilityOverlay";\n'
insert = 'import "./chargementRotations";\n'
if insert in s:
    print("SETOM: chargement rotation manager already imported")
else:
    if needle not in s:
        raise SystemExit("SETOM: profitability import not found")
    s = s.replace(needle, needle + insert, 1)
    path.write_text(s, encoding="utf-8")
    print("SETOM: chargement rotation manager injected")
