from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
for line in [
    'import "./setom_os_dossier_live.css";\n',
]:
    if line not in text:
        text = line + text
path.write_text(text, encoding="utf-8")
