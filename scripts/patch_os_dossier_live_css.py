from pathlib import Path

root = Path(__file__).resolve().parents[1]
main = root / "src" / "main.jsx"
text = main.read_text(encoding="utf-8")
marker = 'import "./dossierNextAction.css";'
line = 'import "./osDossierLive.css";'
if marker in text and line not in text:
    text = text.replace(marker, marker + "\n" + line, 1)
main.write_text(text, encoding="utf-8")
