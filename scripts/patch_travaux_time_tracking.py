from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

if 'from "./travauxTimeTracking"' not in text:
    anchor = 'import "./profitabilityOverlay";'
    if anchor not in text:
        raise SystemExit("SETOM: main import anchor not found")
    text = text.replace(anchor, anchor + '\nimport { TravauxTimeTracking } from "./travauxTimeTracking";', 1)

if 'data-setom-travaux-time-tracking' not in text:
    anchor = '<div className="work-actions">'
    if anchor not in text:
        raise SystemExit("SETOM: Travaux action container not found")
    block = '''<div data-setom-travaux-time-tracking="true"><TravauxTimeTracking orderId={os?.dbId} status={os?.status} /></div>\n      '''
    text = text.replace(anchor, block + anchor, 1)

needle = '      const {error:updateInterventionError}=await supabase.from("interventions").update({status:"Travaux effectués",actual_date:new Date().toISOString().slice(0,10),actual_surface_m2:totalActualSurface>0?totalActualSurface:null}).eq("id",intervention.id);if(updateInterventionError)throw new Error("Impossible de transmettre les travaux : "+updateInterventionError.message);'
if 'window.setomTravauxTimer?.finish(os.dbId);' not in text:
    if needle not in text:
        raise SystemExit("SETOM: transmission intervention update not found")
    replacement = needle + '\n      window.setomTravauxTimer?.finish(os.dbId);'
    text = text.replace(needle, replacement, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: automatic Travaux time tracking mounted")
