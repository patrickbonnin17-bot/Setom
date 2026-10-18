from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "src" / "main.jsx"
s = MAIN.read_text(encoding="utf-8")

marker = 'import "./dashboardIntelligence.css";'
if marker not in s:
    raise SystemExit("staffing intelligence: dashboard intelligence import not found")
if 'import "./staffingIntelligence";' not in s:
    s = s.replace(marker, marker + '\nimport "./staffingIntelligence";', 1)
MAIN.write_text(s, encoding="utf-8")
print("SETOM: staffing intelligence foundation wired")
