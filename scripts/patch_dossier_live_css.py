from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
import_line = 'import "./osDossierLive.css";'

if import_line in text:
    print("SETOM: OS dossier live CSS import already present")
    raise SystemExit(0)

anchor = 'import "./dossierNextAction.css";'
if anchor in text:
    text = text.replace(anchor, anchor + "\n" + import_line, 1)
else:
    # Keep the patch safe: do not inject a stylesheet import into an unknown file shape.
    raise SystemExit("SETOM: dossier live CSS import anchor not found; refusing to modify main.jsx")

path.write_text(text, encoding="utf-8")
print("SETOM: OS dossier live CSS import applied")
