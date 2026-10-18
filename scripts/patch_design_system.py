from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
marker = 'import "./style.css";'
import_line = 'import "./setomDesignSystem.css";'

if import_line not in text:
    if marker not in text:
        raise SystemExit("SETOM design system anchor not found; refusing to modify main.jsx")
    text = text.replace(marker, marker + "\n" + import_line, 1)
    path.write_text(text, encoding="utf-8")
