from pathlib import Path

path = Path("src/constatValidationPatch.jsx")
s = path.read_text(encoding="utf-8")

# SETOM: validation must not reject a freshly generated Brouillon.
old = '''    if (constat.status !== "À vérifier") {
      throw new Error(`Le constat doit être au statut « À vérifier » avant validation (statut actuel : ${constat.status || "inconnu"}).`);
    }
'''
new = '''    const validatableConstatStatuses = ["Brouillon", "À vérifier", "À valider"];
    if (!validatableConstatStatuses.includes(constat.status)) {
      throw new Error(`Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).`);
    }
'''
if old in s:
    s = s.replace(old, new, 1)

# Remove any exact legacy message that may remain in another copy of the handler.
s = s.replace('Le constat doit être au statut « À vérifier » avant validation (statut actuel : ${constat.status || "inconnu"}).', 'Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).')

if "validatableConstatStatuses" not in s:
    raise SystemExit("SETOM: no validation guard found to patch")

path.write_text(s, encoding="utf-8")
print("SETOM: constat validation status aligned")
