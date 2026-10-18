from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# The Travaux form must remain editable throughout the operational workflow.
old = 'fieldset disabled={!canEditWork} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}'
new = 'fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}'
if old in text:
    text = text.replace(old, new, 1)

old_guard = 'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status);'
new_guard = 'const canEditWork = !!profile?.role && profile?.role !== "eau_de_toulouse" && !["Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé","Archivé","Annulé","Doublon"].includes(os?.status);'
if old_guard in text:
    text = text.replace(old_guard, new_guard, 1)

# Keep the transmission button and save() guard aligned with the canonical status
# "En travaux" used by the workflow.
text = text.replace('["Planifié","Travaux en cours","Travaux réalisés"]', '["Planifié","En travaux","Travaux en cours","Travaux réalisés"]')
text = text.replace('["Planifié", "Travaux en cours", "Travaux réalisés"]', '["Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"]')

# Do not let a stale fieldset patch re-disable all Travaux inputs/file pickers.
text = text.replace('<fieldset disabled={isExternalReadOnly || ["Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé","Archivé","Annulé","Doublon"].includes(os?.status)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>', '<fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>', 1)

path.write_text(text, encoding="utf-8")
print("SETOM: final Travaux interaction guard applied")