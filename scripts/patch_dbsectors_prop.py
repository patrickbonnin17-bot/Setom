from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

old_signature = 'function OSModal({ os, onClose, onUpdate, profile }) {'
new_signature = 'function OSModal({ os, onClose, onUpdate, profile, dbSectors = [] }) {'
if old_signature in text:
    text = text.replace(old_signature, new_signature, 1)
elif new_signature not in text:
    raise SystemExit("OSModal signature not found")

old_call = '{selectedOS && <OSModal os={selectedOS} onClose={()=>setSelectedOS(null)} onUpdate={updateOS} profile={currentProfile}/>}'
new_call = '{selectedOS && <OSModal os={selectedOS} onClose={()=>setSelectedOS(null)} onUpdate={updateOS} profile={currentProfile} dbSectors={dbSectors}/>}'
if old_call in text:
    text = text.replace(old_call, new_call, 1)
elif new_call not in text:
    raise SystemExit("OSModal call not found")

path.write_text(text, encoding="utf-8")
print("Patched OSModal dbSectors prop")
