from pathlib import Path

path = Path("src/constatValidationPatch.jsx")
s = path.read_text(encoding="utf-8")

# SETOM: remove every legacy hard block that requires À vérifier.
legacy = '''if (constat.status !== "À vérifier") {
      throw new Error(`Le constat doit être au statut « À vérifier » avant validation (statut actuel : ${constat.status || "inconnu"}).`);
    }'''
if legacy in s:
    s = s.replace(legacy, '''const validatableConstatStatuses = ["Brouillon", "À vérifier", "À valider"];
    if (!validatableConstatStatuses.includes(constat.status)) {
      throw new Error(`Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).`);
    }''', 1)

# Generic safety net for the exact obsolete message, regardless of indentation.
s = s.replace('Le constat doit être au statut « À vérifier » avant validation (statut actuel : ${constat.status || "inconnu"}).', 'Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).')

# If a validation function still exists without the new guard, insert it before the first RPC call.
if "validatableConstatStatuses" not in s:
    marker = 'await supabase.rpc('
    idx = s.find(marker)
    if idx >= 0:
        guard = '''const validatableConstatStatuses = ["Brouillon", "À vérifier", "À valider"];
    if (!validatableConstatStatuses.includes(constat.status)) {
      throw new Error(`Le constat ne peut pas être validé dans son état actuel (statut : ${constat.status || "inconnu"}).`);
    }
    '''
        s = s[:idx] + guard + s[idx:]

path.write_text(s, encoding="utf-8")
print("SETOM: constat validation legacy guard removed")
