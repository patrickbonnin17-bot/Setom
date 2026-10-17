from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
import_line = 'import "./setom_travaux_visual.css";\n'
if import_line not in text:
    text = import_line + text
    path.write_text(text, encoding="utf-8")
print("SETOM: Travaux visual layer loaded")
