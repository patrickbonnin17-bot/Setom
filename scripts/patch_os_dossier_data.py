from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

component = r'''
function OSDossierPilotage({ os, attachments = [], constat = null, constatLines = [], actualRoadSurface, actualSidewalkSurface, actualOtherSurface }) {
  const imageAttachments = attachments.filter((item) => String(item?.mime_type || "").startsWith("image/") && item?.url);
  const hero = imageAttachments[0];
  const plannedFromField = os?.plannedSurfaceM2 == null ? null : Number(os.plannedSurfaceM2);
  const plannedFromQuantity = Number(String(os?.quantity || "").replace(" m²", "").replace(",", ".")) || 0;
  const plannedByZone = (Number(os?.roadSurface) || 0) + (Number(os?.sidewalkSurface) || 0) + (Number(os?.otherSurface) || 0);
  const planned = plannedFromField != null && Number.isFinite(plannedFromField) && plannedFromField > 0
    ? plannedFromField
    : (plannedFromQuantity > 0 ? plannedFromQuantity : (plannedByZone > 0 ? plannedByZone : null));
  const actual = (Number(actualRoadSurface) || 0) + (Number(actualSidewalkSurface) || 0) + (Number(actualOtherSurface) || 0);
  const extension = planned != null && planned > 0 ? Math.max(0, actual - planned) : 0;
  const constatAmount = Number(constat?.total_amount) || 0;
  const constatStatus = constat?.status || os?.constatStatus || "Non généré";
  const progress = planned != null && planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;
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
        {extension > 0 && <div className="setom-os-live-extension-badge">↗ OS AGRANDI · +{extension.toFixed(2)} m²</div>}
      </div>
    </div>
    <div className="setom-os-live-grid">
      <div className="setom-os-live-card"><small>PLANNING</small><strong>{os?.day || "Non planifié"}</strong><span>{os?.plannedDate ? new Date(os.plannedDate + "T12:00:00").toLocaleDateString("fr-FR") : "Date non définie"}</span></div>
      <div className="setom-os-live-card"><small>ÉQUIPE</small><strong>{os?.team || "Non affectée"}</strong><span>{os?.sector || "Secteur non classé"}</span></div>
      <div className="setom-os-live-card"><small>SURFACE RÉALISÉE</small><strong>{actual ? `${actual.toFixed(2)} m²` : "—"}</strong><span>{planned != null ? `${planned.toFixed(2)} m² prévu` : "Surface prévue non renseignée"}{extension > 0 ? ` · +${extension.toFixed(2)} m² d'extension` : ""}</span></div>
      <div className="setom-os-live-card"><small>CONSTAT / FACTURATION</small><strong>{constatAmount ? `${constatAmount.toFixed(2)} €` : "—"}</strong><span>{constatStatus} · {constatLines.length} ligne(s)</span></div>
    </div>
    {planned != null && planned > 0 && <div className="setom-os-live-progress"><div><span>Avancement des surfaces</span><strong>{progress}%{extension > 0 ? " · OS agrandi" : ""}</strong></div><div className="setom-os-live-progress-track"><span style={{ width: `${progress}%` }} /></div></div>}
  </div>;
}

'''

if "function OSDossierPilotage(" not in text:
    marker_start = text.find("function OSModal(")
    if marker_start == -1:
        raise SystemExit("SETOM: OSModal function not found")
    text = text[:marker_start] + component + text[marker_start:]
else:
    start_component = text.find("function OSDossierPilotage(")
    start_modal = text.find("function OSModal(", start_component)
    if start_component != -1 and start_modal != -1:
        text = text[:start_component] + component + text[start_modal:]

start = text.find("function OSModal(")
if start == -1:
    raise SystemExit("SETOM: OSModal function not found")

needle = '    <div className="os-tabs">'
needle_index = text.find(needle, start)
if needle_index == -1:
    raise SystemExit("SETOM: OS tabs marker not found")

if "<OSDossierPilotage" not in text[start:needle_index]:
    injection = '''    <OSDossierPilotage os={os} attachments={os?.attachments || []} constat={os?.constat || null} constatLines={os?.constatLines || []} actualRoadSurface={os?.actualRoadSurface} actualSidewalkSurface={os?.actualSidewalkSurface} actualOtherSurface={os?.actualOtherSurface} />\n'''
    text = text[:needle_index] + injection + text[needle_index:]

path.write_text(text, encoding="utf-8")
print("SETOM: OS dossier live summary harmonized")
