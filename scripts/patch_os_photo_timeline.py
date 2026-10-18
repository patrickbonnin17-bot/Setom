from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

if 'import "./osPhotoTimeline.css";' not in text:
    text = 'import "./osPhotoTimeline.css";\n' + text

component = r'''
function OSPhotoTimeline({ attachments = [] }) {
  const stages = [
    { key: "avant_travaux", label: "Avant travaux", icon: "📍" },
    { key: "travaux_en_cours", label: "En travaux", icon: "🚧" },
    { key: "travaux_realises", label: "Travaux réalisés", icon: "✅" },
    { key: "constat", label: "Constat", icon: "📋" },
  ];
  const photos = attachments.filter((item) => String(item?.mime_type || "").startsWith("image/") && item?.url);
  return <section className="setom-photo-timeline">
    <div className="setom-photo-timeline-head"><div><span>HISTORIQUE VISUEL</span><strong>Photos du chantier</strong></div><small>{photos.length} photo{photos.length > 1 ? "s" : ""}</small></div>
    <div className="setom-photo-timeline-track">
      {stages.map((stage) => {
        const items = photos.filter((photo) => photo.category === stage.key || (stage.key === "travaux_realises" && photo.category === "travaux"));
        return <div className={`setom-photo-stage ${items.length ? "has-photos" : ""}`} key={stage.key}>
          <div className="setom-photo-stage-marker">{stage.icon}</div>
          <div className="setom-photo-stage-body"><div className="setom-photo-stage-title"><strong>{stage.label}</strong><span>{items.length}</span></div>
            {items.length ? <div className="setom-photo-thumbs">{items.map((photo) => <a href={photo.url} target="_blank" rel="noreferrer" key={photo.id || photo.storage_path}><img src={photo.url} alt={photo.file_name || stage.label} /><span>{photo.captured_at ? new Date(photo.captured_at).toLocaleDateString("fr-FR") : "Photo"}</span></a>)}</div> : <p>Aucune photo à cette étape.</p>}
          </div>
        </div>;
      })}
    </div>
  </section>;
}
'''

if "function OSPhotoTimeline(" not in text:
    marker = "function OSDossierPilotage("
    idx = text.find(marker)
    if idx == -1:
        # Fallback: keep the timeline independent of the optional dossier pilotage layer.
        marker = "function OSModal("
        idx = text.find(marker)
    if idx == -1:
        raise SystemExit("SETOM: OS modal anchor not found; refusing to corrupt main.jsx")
    text = text[:idx] + component + "\n" + text[idx:]

marker = '    <OSDossierPilotage os={os} attachments={os?.attachments || []}'
idx = text.find(marker)
if idx != -1:
    end = text.find('\n', idx)
    if end == -1:
        raise SystemExit("SETOM: dossier pilotage usage line not found")
    if "<OSPhotoTimeline" not in text[idx:end + 300]:
        text = text[:end + 1] + '    <OSPhotoTimeline attachments={os?.attachments || []} />\n' + text[end + 1:]
else:
    # Fallback insertion point for builds where the pilotage layer is not present yet.
    fallback = '    <div className="os-v2-photo-callout">'
    idx = text.find(fallback)
    if idx == -1:
        fallback = '    <div className="os-tabs">'
        idx = text.find(fallback)
    if idx == -1:
        raise SystemExit("SETOM: OS timeline insertion anchor not found; refusing to corrupt main.jsx")
    if "<OSPhotoTimeline" not in text[idx:idx + 500]:
        text = text[:idx] + '    <OSPhotoTimeline attachments={os?.attachments || []} />\n' + text[idx:]

path.write_text(text, encoding="utf-8")
print("SETOM: OS photo timeline added")
