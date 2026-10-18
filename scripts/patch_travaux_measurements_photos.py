from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

marker = "data-setom-travaux-photo-zone"
if marker not in text:
    anchor = '<div className="work-actions">'
    if anchor not in text:
        raise SystemExit("SETOM: Travaux action container not found")
    block = r'''<div data-setom-travaux-photo-zone="true" className="work-photo-zone" style={{ margin: "16px 0", padding: 16, border: "1px solid #dbe3ef", borderRadius: 14, background: "#f8fafc" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div><strong>📷 Photos des travaux réalisés</strong><div style={{ color: "#667085", fontSize: 13, marginTop: 4 }}>Ajoutez une photo depuis un fichier ou prenez directement une photo avec le téléphone.</div></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className="secondary" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", padding: "9px 12px", borderRadius: 9 }}>
              📷 Prendre une photo
              <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }} onChange={(event) => setWorkPhotoFiles(Array.from(event.target.files || []))} />
            </label>
            <label className="secondary" style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", padding: "9px 12px", borderRadius: 9 }}>
              📁 Ajouter un fichier
              <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(event) => setWorkPhotoFiles(Array.from(event.target.files || []))} />
            </label>
          </div>
        </div>
        {(workPhotoFiles?.length || 0) > 0 && <div style={{ marginTop: 10, fontSize: 13 }}>{workPhotoFiles.length} photo(s) prête(s) à enregistrer.</div>}
        {(attachments || []).filter((file) => file.category === "travaux_realises").length > 0 && <div style={{ marginTop: 6, fontSize: 12, color: "#667085" }}>{(attachments || []).filter((file) => file.category === "travaux_realises").length} photo(s) déjà enregistrée(s).</div>}
      </div>

      <div className="work-measurement-summary" style={{ margin: "16px 0", padding: 16, border: "1px solid #dbe3ef", borderRadius: 14, background: "#fff" }}>
        <strong>📐 Mesures réelles</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 10 }}>
          <div><span style={{ display: "block", fontSize: 12, color: "#667085" }}>Chaussée</span><strong>{Number(realRoadSurface || 0).toFixed(2)} m²</strong></div>
          <div><span style={{ display: "block", fontSize: 12, color: "#667085" }}>Trottoir</span><strong>{Number(realSidewalkSurface || 0).toFixed(2)} m²</strong></div>
          <div><span style={{ display: "block", fontSize: 12, color: "#667085" }}>Autre</span><strong>{Number(realOtherSurface || 0).toFixed(2)} m²</strong></div>
          <div><span style={{ display: "block", fontSize: 12, color: "#667085" }}>Total retenu</span><strong>{Number(totalSurface || 0).toFixed(2)} m²</strong></div>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#667085" }}>Les valeurs saisies dans les champs de longueur, largeur et surface réelle sont conservées dans le brouillon puis utilisées lors de la transmission.</div>
      </div>

      '''
    text = text.replace(anchor, block + anchor, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: Travaux measurement/photo capture zone added")
