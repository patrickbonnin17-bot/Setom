from pathlib import Path

path = Path("src/constatValidationPatch.jsx")
s = path.read_text(encoding="utf-8")
old_msg = 'Le constat doit être au statut « À vérifier » avant validation (statut actuel : ${constat.status || "inconnu"}).'
s = s.replace(old_msg, 'Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).')
s = s.replace('if (constat.status !== "À vérifier") {', 'if (!["Brouillon", "À vérifier", "À valider"].includes(constat.status)) {')
path.write_text(s, encoding="utf-8")
print("SETOM: constat validation guard aligned")
