from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
marker = 'import "./dashboardLoadWidget";\n'
if marker not in text:
    text = marker + text
path.write_text(text, encoding="utf-8")
