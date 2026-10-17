from pathlib import Path

path = Path("src/constatValidationPatch.jsx")
s = path.read_text(encoding="utf-8")

# Keep the complete existing handler; only replace the legacy status gate.
old_msg = 'Le constat doit être au statut « À vérifier » avant validation (statut actuel : ${constat.status || "inconnu"}).'
s = s.replace(old_msg, 'Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).')
old_gate = 'if (constat.status !== "À vérifier") {'
if old_gate in s:
    s = s.replace(old_gate, 'if (!["Brouillon", "À vérifier", "À valider"].includes(constat.status)) {', 1)
path.write_text(s, encoding="utf-8")
print("SETOM: constat validation guard aligned")
