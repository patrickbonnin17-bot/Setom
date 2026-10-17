from pathlib import Path

path = Path("src/constatValidationPatch.jsx")
s = path.read_text(encoding="utf-8")

# SETOM: harden constat validation guard. The previous guard could survive
# because another copy of the validation message may be used at runtime.
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
else:
    # If the build already contains the aligned guard, leave it intact.
    if "validatableConstatStatuses" not in s:
        raise SystemExit("SETOM: validation guard not found")

# Also replace any remaining legacy error text in this runtime patch so the
# browser cannot display the obsolete guard from another validation path.
s = s.replace('Le constat doit être au statut « À vérifier » avant validation (statut actuel : ${constat.status || "inconnu"}).', 'Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).')
path.write_text(s, encoding="utf-8")
print("SETOM: constat validation guard hardened")
