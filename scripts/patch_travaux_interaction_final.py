from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# The Travaux form is wrapped in a fieldset. Make its UI lock depend only on
# genuinely closed states and external read-only access, never on a transient
# profile-loading state. This prevents all inputs and file pickers from being
# disabled even though the OS is operationally editable.
old = 'fieldset disabled={!canEditWork} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}'
new = 'fieldset disabled={isExternalReadOnly || ["Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé","Archivé","Annulé","Doublon"].includes(os?.status)} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}'
if old in text:
    text = text.replace(old, new, 1)

# Keep the work permission guard itself explicit and stable.
old_guard = 'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status);'
new_guard = 'const canEditWork = !!profile?.role && profile?.role !== "eau_de_toulouse" && !["Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé","Archivé","Annulé","Doublon"].includes(os?.status);'
if old_guard in text:
    text = text.replace(old_guard, new_guard, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: final Travaux interaction guard applied")
