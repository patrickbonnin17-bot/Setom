from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "src" / "main.jsx"
CSS = ROOT / "src" / "brochureVisuals.css"

s = MAIN.read_text(encoding="utf-8")

# Load one signed image per OS for the list cards. Existing OS detail attachment logic remains untouched.
anchor = '      const teamById = new Map(teams.map((team) => [team.id, team.name]));'
if 'const attachmentRows = workOrderIds.length ? await supabase.from("attachments")' not in s:
    block = '''      const attachmentResult = workOrderIds.length
        ? await supabase.from("attachments").select("id, work_order_id, category, mime_type, storage_path, created_at").in("work_order_id", workOrderIds).order("created_at", { ascending: false })
        : { data: [], error: null };
      if (attachmentResult.error) console.error("Erreur chargement photos des OS :", attachmentResult.error);
      const attachmentRows = attachmentResult.data || [];
      const coverByOS = new Map();
      for (const attachment of attachmentRows) {
        if (!String(attachment.mime_type || "").startsWith("image/")) continue;
        if (!coverByOS.has(attachment.work_order_id)) {
          const signed = await supabase.storage.from("setom-files").createSignedUrl(attachment.storage_path, 3600);
          coverByOS.set(attachment.work_order_id, signed.error ? null : (signed.data?.signedUrl || null));
        }
      }
'''
    if anchor not in s:
        raise SystemExit("SETOM: teamById anchor not found")
    s = s.replace(anchor, block + anchor, 1)

# Add coverPhotoUrl to formatted OS objects.
needle = '          team: teamById.get(intervention?.team_id) || "Non affectée", teamId: intervention?.team_id || null,'
replacement = '          team: teamById.get(intervention?.team_id) || "Non affectée", teamId: intervention?.team_id || null, coverPhotoUrl: coverByOS.get(row.id) || null,'
if needle in s and 'coverPhotoUrl: coverByOS.get(row.id)' not in s:
    s = s.replace(needle, replacement, 1)

# Replace the compact OS card with a brochure-like visual card while preserving its actions/data.
pattern = re.compile(r'function OSCard\(\{ os, onOpen \}\) \{.*?\n\}\n\nfunction OSModal', re.S)
match = pattern.search(s)
if match:
    card = '''function OSCard({ os, onOpen }) {
  const displayStatus = os.constatStatus === "Validé avec réserve" && !os.reserveResolvedAt ? "Réserve" : os.status;
  const statusColors = getOSStatusColors(displayStatus);
  return <article className="setom-brochure-os-card" style={{ "--os-accent": statusColors.accent }}>
    <div className="setom-brochure-os-photo">
      {os.coverPhotoUrl ? <img src={os.coverPhotoUrl} alt={"Photo " + os.id} loading="lazy" /> : <div className="setom-brochure-photo-empty"><span>📷</span><small>Photo chantier</small></div>}
      <span className="setom-brochure-os-status" style={getOSStatusBadgeStyle(displayStatus)}>{os.constatStatus === "Validé avec réserve" && !os.reserveResolvedAt ? "Réserve à lever" : os.status}</span>
    </div>
    <div className="setom-brochure-os-body">
      <div className="setom-brochure-os-head"><div><strong>{os.id}</strong><span>📍 {os.address || "Adresse non renseignée"}</span></div><span className="setom-brochure-os-sector">{os.sector || "Non classé"}</span></div>
      {os.constatStatus === "Validé avec réserve" && !os.reserveResolvedAt && os.reserveReason && <div className="setom-brochure-reserve">🚧 {os.reserveReason}</div>}
      <div className="setom-brochure-os-grid"><div><small>TRAVAUX</small><b>{os.work || "Intervention"}</b></div><div><small>SURFACE</small><b>{os.quantity || "—"}</b></div><div><small>ÉQUIPE</small><b>{os.team || "Non affectée"}</b></div><div><small>DATE</small><b>{os.day || "Non planifié"}</b></div></div>
      <div className="setom-brochure-os-actions"><button className="primary" onClick={onOpen}>Ouvrir l'OS</button><button className="secondary" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(os.address || "")}`, "_blank")}>🧭 Itinéraire</button></div>
    </div>
  </article>;
}

function OSModal'''
    s = s[:match.start()] + card + s[match.end():]
else:
    raise SystemExit("SETOM: OSCard/OSModal block not found")

# Keep visual CSS as a dedicated layer.
import_marker = 'import "./workflowRail.css";'
if 'import "./brochureVisuals.css";' not in s:
    if import_marker not in s:
        raise SystemExit("SETOM: workflowRail import marker not found")
    s = s.replace(import_marker, import_marker + '\nimport "./brochureVisuals.css";', 1)

MAIN.write_text(s, encoding="utf-8")
CSS.write_text('''/* SETOM brochure visual system — visual layer only */
:root{--setom-navy:#062a45;--setom-blue:#0788ee;--setom-bg:#eef3f7;--setom-line:#d8e3eb;--setom-text:#102b43;--setom-muted:#6d7e8e}
@media(min-width:980px){
  .header{padding-left:24px!important}
  .header>.nav,.nav{position:fixed!important;left:0!important;top:86px!important;bottom:0!important;width:224px!important;height:auto!important;margin:0!important;padding:16px 10px!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:4px!important;background:var(--setom-navy)!important;overflow-y:auto!important;overflow-x:hidden!important;box-shadow:4px 0 18px rgba(6,42,69,.12)!important;z-index:1001!important}
  .nav button{flex:0 0 46px!important;width:100%!important;min-width:0!important;height:46px!important;min-height:46px!important;padding:8px 14px!important;border-radius:8px!important;text-align:left!important;font-size:12px!important;color:rgba(255,255,255,.84)!important;background:transparent!important}
  .nav button:hover{background:rgba(255,255,255,.08)!important;color:#fff!important}.nav button.active{background:linear-gradient(90deg,#0788ee,#006fc9)!important;color:#fff!important;box-shadow:none!important}
  .container{padding-left:250px!important;padding-right:24px!important}
  .setom-brochure-os-card{display:grid;grid-template-columns:250px minmax(0,1fr);min-height:190px;background:#fff;border:1px solid var(--setom-line);border-left:4px solid var(--os-accent);border-radius:12px;overflow:hidden;box-shadow:0 5px 16px rgba(17,42,62,.055);margin-bottom:12px}
}
.setom-brochure-os-photo{position:relative;min-height:190px;background:linear-gradient(135deg,#dfe8ee,#b9c9d5);overflow:hidden}.setom-brochure-os-photo img{width:100%;height:100%;min-height:190px;display:block;object-fit:cover}.setom-brochure-photo-empty{height:100%;min-height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#6d7e8e;background:linear-gradient(135deg,#e8eef2,#d3dfe7)}.setom-brochure-photo-empty span{font-size:34px}.setom-brochure-photo-empty small{margin-top:5px;font-weight:700}.setom-brochure-os-status{position:absolute;left:12px;top:12px;padding:5px 9px;border-radius:999px;font-size:10px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.1)}.setom-brochure-os-body{padding:15px 17px;display:flex;flex-direction:column;gap:11px}.setom-brochure-os-head{display:flex;justify-content:space-between;gap:12px}.setom-brochure-os-head>div{display:flex;flex-direction:column;gap:4px;min-width:0}.setom-brochure-os-head strong{font-size:17px;color:var(--setom-text)}.setom-brochure-os-head span{font-size:12px;color:var(--setom-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.setom-brochure-os-sector{align-self:flex-start;background:#edf5fb;color:#17618c!important;padding:5px 8px;border-radius:7px;font-weight:700}.setom-brochure-reserve{background:#fff5e9;border:1px solid #f2d5aa;color:#8a5414;border-radius:7px;padding:7px 9px;font-size:11px}.setom-brochure-os-grid{display:grid;grid-template-columns:2fr 1fr 1.2fr 1fr;gap:8px}.setom-brochure-os-grid>div{background:#f6f9fb;border:1px solid #e4ebf0;border-radius:7px;padding:7px 9px;min-width:0}.setom-brochure-os-grid small{display:block;color:#7b8a97;font-size:8px;font-weight:800;letter-spacing:.05em}.setom-brochure-os-grid b{display:block;margin-top:3px;color:#17334d;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.setom-brochure-os-actions{display:flex;gap:7px;margin-top:auto}.setom-brochure-os-actions button{min-height:34px}
.map{position:relative;min-height:560px;border-radius:12px!important;border:1px solid #d7e2ea!important;background:linear-gradient(135deg,#dfe9ee,#f7fafb)!important;overflow:hidden;box-shadow:0 5px 18px rgba(17,42,62,.07)!important}.map:before{content:"CARTE DES INTERVENTIONS";position:absolute;left:18px;top:16px;z-index:2;background:rgba(255,255,255,.92);border:1px solid #dce6ec;border-radius:8px;padding:7px 10px;color:#17334d;font-size:10px;font-weight:800;letter-spacing:.05em}.map-road{position:absolute;inset:0;background:linear-gradient(28deg,transparent 43%,rgba(255,255,255,.88) 44%,rgba(255,255,255,.88) 48%,transparent 49%),linear-gradient(-18deg,transparent 57%,rgba(255,255,255,.75) 58%,rgba(255,255,255,.75) 61%,transparent 62%)}.marker{z-index:4!important;width:34px!important;height:34px!important;border-radius:50%!important;border:4px solid #fff!important;box-shadow:0 3px 10px rgba(0,0,0,.25)!important;color:#fff!important;font-size:18px!important}
.planning{overflow:hidden}.planning .week{background:#fff}.planning .day{min-height:520px!important;background:#f9fbfc!important;border-right:1px solid #dce6ed!important}.planning .day-header{position:sticky;top:0;z-index:3;padding:12px 10px!important;border-radius:7px!important;color:#fff!important;font-weight:800!important;text-align:left!important}.planning-os{padding:10px!important;border-radius:9px!important;background:#fff!important;border:1px solid #dbe5ec!important;box-shadow:0 3px 8px rgba(17,42,62,.06)!important;cursor:pointer}.planning-os:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(17,42,62,.1)!important}
@media(max-width:979px){.setom-brochure-os-card{display:block}.setom-brochure-os-photo{min-height:160px}.setom-brochure-os-photo img{min-height:160px}.setom-brochure-os-grid{grid-template-columns:1fr 1fr}.map{min-height:420px}.nav{display:flex;overflow-x:auto}}
''', encoding="utf-8")
print("SETOM: brochure visuals applied")
