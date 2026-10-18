from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# Do not use a fieldset-level disabled attribute for Travaux. It is too easy for
# React/browser state to freeze every descendant input, including file inputs.
old = '<fieldset disabled={!canEditWork} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>'
if old in text:
    text = text.replace(old, '<fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>', 1)

# The current workflow explicitly allows editing while an OS is being executed.
old_button = '["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status)'
new_button = '["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status)'
text = text.replace(old_button, new_button)

# Never render a misleading lock message while Travaux is operationally editable.
old_message = '!["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status)'
new_message = '!["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status)'
text = text.replace(old_message, new_message)

# Remove any remaining direct disabled binding on the Travaux fieldset if a prior
# patch has rewritten its condition differently.
text = text.replace('<fieldset disabled={isExternalReadOnly || ["Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé","Archivé","Annulé","Doublon"].includes(os?.status)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>', '<fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>', 1)

path.write_text(text, encoding="utf-8")
print("SETOM: Travaux fieldset fully unlocked; En travaux transmission enabled")
