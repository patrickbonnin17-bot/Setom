from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
needle = 'import "./profitabilityOverlay";'
addition = 'import "./constatVisual";'
if addition not in text:
    if needle in text:
        text = text.replace(needle, needle + "\n" + addition, 1)
    else:
        text = addition + "\n" + text
    path.write_text(text, encoding="utf-8")
