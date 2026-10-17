from pathlib import Path
import re

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# 1) OSModal uses the sectors loaded by App. Pass them explicitly instead of
# relying on an out-of-scope variable (this caused the runtime crash on edit).
text, n_call = re.subn(
    r'<OSModal os=\{selectedOS\} onClose=\{\(\)=>setSelectedOS\(null\)\} onUpdate=\{updateOS\} profile=\{currentProfile\}/>',
    '<OSModal os={selectedOS} onClose={()=>setSelectedOS(null)} onUpdate={updateOS} profile={currentProfile} dbSectors={dbSectors}/>',
    text,
    count=1,
)
text, n_sig = re.subn(
    r'function OSModal\(\{ os, onClose, onUpdate, profile \}\)',
    'function OSModal({ os, onClose, onUpdate, profile, dbSectors = [] })',
    text,
    count=1,
)

# 2) Travaux must remain editable for every internal SETOM profile during the
# operational lifecycle. The external validation account remains read-only.
# Only genuinely closed workflow statuses lock the work sheet.
work_guard = (
    'const canEditWork = !!profile?.role && profile?.role !== "eau_de_toulouse" '
    '&& !["Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé","Archivé","Annulé","Doublon"].includes(os?.status);'
)
text, n_guard = re.subn(
    r'const canEditWork\s*=\s*[^;]+;',
    work_guard,
    text,
    count=1,
)

path.write_text(text, encoding="utf-8")
print(f"SETOM: Travaux editable for internal profiles (OSModal prop={n_call}, signature={n_sig}, work guard={n_guard})")
