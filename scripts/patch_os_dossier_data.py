from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

if "function OSDossierPilotage(" not in text:
    component = r'''
function OSDossierPilotage({ os, attachments = [], constat = null, constatLines = [], actualRoadSurface, actualSidewalkSurface, actualOtherSurface }) {
  const imageAttachments = attachments.filter((item) => String(item?.mime_type || "").startsWith("image/") && item?.url);
  const hero = imageAttachments[0];
  const planned = Number(os?.quantity?.replace?.(" m²", "")) || 0;
  const actual = (Number(actualRoadSurface) || 0) + (Number(actualSidewalkSurface) || 0) + (Number(actualOtherSurface) || 0);
  const constatAmount = Number(constat?.total_amount) || 0;
  const constatStatus = constat?.status || os?.constatStatus || "Non généré";
  const progress = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
  return <div className="setom-os-live-dossier">
    <div className="setom-os-live-hero">
      <div className="setom-os-live-photo">
        {hero ? <img src={hero.url} alt={`Photo ${os?.id || "OS"}`} /> : <div className="setom-os-live-photo-empty"><span>📷</span><strong>Photo chantier</strong><small>Aucune photo disponible pour cet OS</small></div>}
        {imageAttachments.length > 1 && <div className="setom-os-live-photo-count">📷 {imageAttachments.length} photos</div>}
      </div>
      <div className="setom-os-live-hero-meta">
        <span className="setom-os-live-kicker">Dossier opérationnel</span>
        <strong>{os?.id || "OS"}</strong>
        <span>{os?.address || "Adresse non renseignée"}</span>
        <div className="setom-os-live-status">● {os?.status || "Nouveau"}</div>
      </div>
    </div>
    <div className="setom-os-live-grid">
      <div className="setom-os-live-card"><small>PLANNING</small><strong>{os?.day || "Non planifié"}</strong><span>{os?.plannedDate ? new Date(os.plannedDate + "T12:00:00").toLocaleDateString("fr-FR") : "Date non définie"}</span></div>
      <div className="setom-os-live-card"><small>ÉQUIPE</small><strong>{os?.team || "Non affectée"}</strong><span>{os?.sector || "Secteur non classé"}</span></div>
      <div className="setom-os-live-card"><small>SURFACE RÉALISÉE</small><strong>{actual ? `${actual.toFixed(2)} m²` : "—"}</strong><span>{planned ? `${planned.toFixed(2)} m² prévu` : "Surface prévue non renseignée"}</span></div>
      <div className="setom-os-live-card"><small>CONSTAT / FACTURATION</small><strong>{constatAmount ? `${constatAmount.toFixed(2)} €` : "—"}</strong><span>{constatStatus} · {constatLines.length} ligne(s)</span></div>
    </div>
    {planned > 0 && <div className="setom-os-live-progress"><div><span>Avancement des surfaces</span><strong>{progress}%</strong></div><div className="setom-os-live-progress-track"><span style={{ width: `${progress}%` }} /></div></div>}
  </div>;
}

'''
    marker_start = text.find("function OSModal(")
    if marker_start == -1:
        raise SystemExit("SETOM: OSModal function not found")
    text = text[:marker_start] + component + text[marker_start:]

start = text.find("function OSModal(")
end = text.find("function OSCard(", start)
if start == -1 or end == -1:
    raise SystemExit("SETOM: OSModal section boundaries not found")
section = text[start:end]
needle = '    <div className="os-tabs">'
if "<OSDossierPilotage" not in section:
    if needle not in section:
        raise SystemExit("SETOM: OS tabs marker not found")
    # Keep the live dossier safe: these optional values are derived from the OS object,
    # so the injected component never references variables outside OSModal scope.
    injection = '''    <OSDossierPilotage os={os} attachments={os?.attachments || []} constat={os?.constat || null} constatLines={os?.constatLines || []} actualRoadSurface={os?.actualRoadSurface} actualSidewalkSurface={os?.actualSidewalkSurface} actualOtherSurface={os?.actualOtherSurface} />\n'''
    section = section.replace(needle, injection + needle, 1)
    text = text[:start] + section + text[end:]

path.write_text(text, encoding="utf-8")
print("SETOM: OS dossier live summary connected safely")
