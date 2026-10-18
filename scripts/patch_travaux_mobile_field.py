from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
import_line = 'import "./travauxMobileField.css";\n'
if import_line not in text:
    text = import_line + text
marker = 'data-setom-travaux-photo-zone="true"'
if marker in text and 'data-setom-travaux-mobile="true"' not in text:
    text = text.replace(marker, 'data-setom-travaux-mobile="true" ' + marker, 1)
path.write_text(text, encoding="utf-8")
print("SETOM: mobile Travaux field layer enabled")
