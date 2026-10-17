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

# 2) The field sheet must be editable while the OS is operational. Keep the
# permission check by role, but do not lock the form merely because the OS is
# still in an early planning status.
work_guard = (
    'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) '
    '&& !["Validé","Validé avec réserve","Réserve","Correction à réaliser","Payé","Archivé","Annulé","Doublon"].includes(os?.status);'
)
text, n_guard = re.subn(
    r'const canEditWork\s*=\s*\["admin"\s*,?\s*"bureau"\s*,?\s*"equipe_terrain"\]\.(?:includes)\(profile\?\.role\)\s*&&\s*\[[^\]]+\]\.includes\(os\?\.status\);',
    work_guard,
    text,
    count=1,
)

# 3) Prevent a stale disabled fieldset from surviving an old guard. The
# canEditWork expression above remains the single source of truth.
if 'fieldset disabled={!canEditWork}' not in text:
    # Do not rewrite if the source has already been changed by a future version.
    pass

path.write_text(text, encoding="utf-8")
print(f"SETOM: runtime fixes applied (OSModal prop={n_call}, signature={n_sig}, work guard={n_guard})")
