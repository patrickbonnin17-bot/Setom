from pathlib import Path

path = Path("src/constatValidationPatch.jsx")
s = path.read_text(encoding="utf-8")

legacy_message = 'Le constat doit être au statut « À vérifier » avant validation (statut actuel : ${constat.status || "inconnu"}).'
s = s.replace(legacy_message, 'Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).')

# Replace the exact legacy guard wherever it appears.
legacy_guard = '''if (constat.status !== "À vérifier") {
      throw new Error(`Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).`);
    }'''
if legacy_guard in s:
    s = s.replace(legacy_guard, '''const validatableConstatStatuses = ["Brouillon", "À vérifier", "À valider"];
    if (!validatableConstatStatuses.includes(constat.status)) {
      throw new Error(`Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).`);
    }''', 1)

# If another old equality guard survived with the new message, remove it too.
old_guard = '''if (constat.status !== "À vérifier") {
      throw new Error(`Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).`);
    }'''
if old_guard in s:
    s = s.replace(old_guard, '''const validatableConstatStatuses = ["Brouillon", "À vérifier", "À valider"];
    if (!validatableConstatStatuses.includes(constat.status)) {
      throw new Error(`Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).`);
    }''', 1)

path.write_text(s, encoding="utf-8")
print("SETOM: constat validation patch hardened")
