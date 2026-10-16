from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# Normalize every status guard used by the active OS / Travaux workflow.
# Keep this build-time safety net until the large main.jsx file is cleaned up
# into smaller workflow modules.
replacements = {
    '["Planifié","Travaux en cours","Travaux réalisés"]': '["Planifié","En travaux","Travaux en cours","Travaux réalisés"]',
    '["Planifié", "Travaux en cours", "Travaux réalisés"]': '["Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"]',
    '["Nouveau", "À planifier", "Planifié", "Travaux en cours", "En erreur"]': '["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "En erreur"]',
    '["À planifier", "Planifié", "Travaux en cours", "En erreur"]': '["À planifier", "Planifié", "En travaux", "Travaux en cours", "En erreur"]',
}

for old, new in replacements.items():
    text = text.replace(old, new)

# Treat a reintroduced legacy guard as a build failure instead of silently
# shipping a UI where "En travaux" becomes read-only again.
legacy_guards = [
    '["Planifié","Travaux en cours","Travaux réalisés"]',
    '["Planifié", "Travaux en cours", "Travaux réalisés"]',
    '["Nouveau", "À planifier", "Planifié", "Travaux en cours", "En erreur"]',
    '["À planifier", "Planifié", "Travaux en cours", "En erreur"]',
]
remaining = [guard for guard in legacy_guards if guard in text]
if remaining:
    raise SystemExit("SETOM: legacy workflow status guard detected: " + " | ".join(remaining))

path.write_text(text, encoding="utf-8")
print("SETOM: En travaux enabled across OS editing, issue reporting and work transmission guards")
