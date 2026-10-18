from pathlib import Path

root = Path(__file__).resolve().parents[1]
main = root / "src" / "main.jsx"
text = main.read_text(encoding="utf-8")
marker = 'import "./targetUiV2.css";'
import_line = 'import "./setomSidebar.css";'
if import_line not in text:
    if marker not in text:
        raise SystemExit("targetUiV2 import marker not found")
    text = text.replace(marker, marker + "\n" + import_line, 1)
    main.write_text(text, encoding="utf-8")
