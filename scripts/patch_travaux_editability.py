from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# The work sheet must remain editable throughout the active operational lifecycle.
# Once an OS is archived, paid, cancelled or otherwise closed, the existing guards
# can keep it read-only. The active statuses below must not block entry of real work.
active_statuses = '["Nouveau","À planifier","Planifié","En travaux","Travaux en cours","Travaux réalisés"]'

replacements = {
    'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status);':
        f'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && {active_statuses}.includes(os?.status);',
    'const canEditWork = ["admin", "bureau", "equipe_terrain"].includes(profile?.role) && ["Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"].includes(os?.status);':
        f'const canEditWork = ["admin", "bureau", "equipe_terrain"].includes(profile?.role) && {active_statuses}.includes(os?.status);',
}

for old, new in replacements.items():
    text = text.replace(old, new)

# Keep the transmission guard aligned with the editable work form.
text = text.replace(
    '["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status)',
    active_statuses + '.includes(os?.status)'
)
text = text.replace(
    '["Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"].includes(os?.status)',
    active_statuses + '.includes(os?.status)'
)

path.write_text(text, encoding="utf-8")
print("SETOM: Travaux editable for all active operational statuses")
