from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

old_header = '''    <div className="modal-header"><div><h2>{os.id}</h2><small>{os.address}</small></div><button className="close" onClick={onClose} type="button">×</button></div>'''
new_header = '''    <div className="modal-header"><div><h2>{os.id}</h2><small>{os.address}</small></div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>{["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Nouveau", "À planifier", "Planifié", "Travaux en cours", "En erreur"].includes(os.status) && <button type="button" className="secondary" onClick={() => { setActiveTab("resume"); setOsEditError(""); setOsEditMode(true); }} disabled={osEditLoading || osEditSaving}>✏️ Modifier l'OS</button>}<button className="close" onClick={onClose} type="button">×</button></div></div>'''
if old_header not in text:
    raise SystemExit("SETOM: OS header marker not found")
text = text.replace(old_header, new_header, 1)

form_marker = '''      <div style={{ gridColumn: "1 / -1" }}><label htmlFor="os-edit-particularities">Particularités / consignes</label><textarea id="os-edit-particularities" rows={3} value={osEditDraft.particularities} onChange={(e) => setOsEditDraft((current) => ({ ...current, particularities: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }}/></div>'''
photo_block = '''      <div style={{ gridColumn: "1 / -1", padding: 14, border: "1px solid #b8d4ee", borderRadius: 12, background: "#f5faff" }}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><div><strong>📷 Photo avant travaux</strong><div style={{fontSize:12,color:"#667085",marginTop:3}}>Ajoutez ici l'état initial de la zone. Elle sera conservée dans le dossier OS.</div></div><label className="attachment-button" style={{margin:0}}>📷 Prendre / choisir<input type="file" accept="image/*" capture="environment" multiple onChange={(e)=>{setOsPhotoCategory("avant_travaux");setOsPhotoFiles((current)=>[...current,...Array.from(e.target.files||[]).filter((file)=>file.type.startsWith("image/"))]);e.target.value="";}}/></label></div>{osPhotoCategory==="avant_travaux"&&osPhotoFiles.length>0&&<div style={{marginTop:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:12,color:"#475467"}}>{osPhotoFiles.length} photo(s) prête(s)</span><button type="button" className="primary" disabled={osPhotoSaving} onClick={()=>uploadOSPhotos("avant_travaux")}>{osPhotoSaving?"Enregistrement…":"💾 Enregistrer"}</button><button type="button" className="secondary" disabled={osPhotoSaving} onClick={()=>setOsPhotoFiles([])}>Annuler</button></div>}{attachments.filter((file)=>file.category==="avant_travaux"&&file.mime_type?.startsWith("image/")&&file.url).length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8,marginTop:12}}>{attachments.filter((file)=>file.category==="avant_travaux"&&file.mime_type?.startsWith("image/")&&file.url).map((file)=><button key={file.id} type="button" onClick={()=>setPreviewAttachment(file)} style={{border:"1px solid #d0d5dd",background:"#fff",borderRadius:8,padding:3,cursor:"pointer"}}><img src={file.url} alt={file.file_name||"Avant travaux"} style={{display:"block",width:"100%",height:90,objectFit:"cover",borderRadius:6}}/></button>)}</div>}</div>'''
if form_marker not in text:
    raise SystemExit("SETOM: OS edit form marker not found")
text = text.replace(form_marker, form_marker + "\n" + photo_block, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: OS edit button and before-work photo controls added")
