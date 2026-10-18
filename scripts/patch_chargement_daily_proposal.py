from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
needle = 'import "./chargementRealConsumptionOverlay";'
addition = needle + '\nimport "./chargementDailyProposalOverlay";'
if "./chargementDailyProposalOverlay" not in text:
    if needle not in text:
        raise SystemExit("chargement real consumption import not found")
    text = text.replace(needle, addition, 1)
path.write_text(text, encoding="utf-8")
print("SETOM: daily loading proposal overlay wired")
