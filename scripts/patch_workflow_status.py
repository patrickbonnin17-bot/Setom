from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# Normalize every active-work status guard used by the Travaux workflow.
# This keeps the build resilient if a guard is added in another part of main.jsx.
status_variants = [
    '["Planifié","Travaux en cours","Travaux réalisés"]',
    '["Planifié", "Travaux en cours", "Travaux réalisés"]',
]
for old in status_variants:
    text = text.replace(old, '["Planifié","En travaux","Travaux en cours","Travaux réalisés"]')

path.write_text(text, encoding="utf-8")
print("SETOM: En travaux is editable/transmittable in Travaux")
