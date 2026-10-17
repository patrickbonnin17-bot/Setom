from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# The real operational status used by SETOM is "En travaux". Keep the work form editable
# for the same operational statuses as the rest of the workflow.
replacements = {
    'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status);':
        'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status);',
    'const canEditWork = ["admin", "bureau", "equipe_terrain"].includes(profile?.role) && ["Planifié", "Travaux en cours", "Travaux réalisés"].includes(os?.status);':
        'const canEditWork = ["admin", "bureau", "equipe_terrain"].includes(profile?.role) && ["Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"].includes(os?.status);',
}
for old, new in replacements.items():
    text = text.replace(old, new)

# The transmission action must use the same guard as the editable form.
text = text.replace(
    '["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status)',
    '["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status)'
)
text = text.replace(
    '["Planifié", "Travaux en cours", "Travaux réalisés"].includes(os?.status)',
    '["Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"].includes(os?.status)'
)

path.write_text(text, encoding="utf-8")
print("SETOM: Travaux editable for En travaux")
