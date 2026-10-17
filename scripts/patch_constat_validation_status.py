from pathlib import Path

path = Path("src/constatValidationPatch.jsx")
s = path.read_text(encoding="utf-8")

if "SETOM: constat validation status aligned" in s:
    print("SETOM: constat validation status already aligned")
    raise SystemExit(0)

old = '''    if (constat.status !== "À vérifier") {
      throw new Error(`Le constat doit être au statut « À vérifier » avant validation (statut actuel : ${constat.status || "inconnu"}).`);
    }
'''

new = '''    // Le RPC Supabase accepte explicitement Brouillon, À vérifier et À valider.
    // Le front ne doit donc pas bloquer un constat fraîchement généré en Brouillon.
    const validatableConstatStatuses = ["Brouillon", "À vérifier", "À valider"];
    if (!validatableConstatStatuses.includes(constat.status)) {
      throw new Error(`Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).`);
    }
'''

if old not in s:
    raise SystemExit("SETOM: constat validation status guard not found")

s = s.replace(old, new, 1)
s += "\n// SETOM: constat validation status aligned\n"
path.write_text(s, encoding="utf-8")
print("SETOM: constat validation status aligned with database RPC")
