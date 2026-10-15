# Applies the mobile Travaux/photo controls directly to src before stabilization.
from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

old_can = 'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status);'
new_can = 'const canEditWork = ["admin","bureau","equipe_terrain"].includes(profile?.role) && ["À planifier","Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status);'
if old_can in text:
    text = text.replace(old_can, new_can, 1)

old_actions = '{["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}>✅ Transmettre les travaux réalisés</button>}{!["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <span style={{ color: "#667085", fontSize: 13 }}>Les travaux ne peuvent plus être transmis depuis ce statut.</span>}'
new_actions = '{["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}>✅ Transmettre les travaux réalisés</button>}{os?.status === "À planifier" && <span style={{ color: "#667085", fontSize: 13 }}>Préparation possible : renseignez les mesures et ajoutez les photos. La transmission sera disponible après planification.</span>}{!["À planifier","Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status) && <span style={{ color: "#667085", fontSize: 13 }}>Les travaux ne peuvent plus être transmis depuis ce statut.</span>}'
if old_actions in text:
    text = text.replace(old_actions, new_actions, 1)

start = '<div className="attachments-section" style={{marginTop:18}}><label>📷 Photos des travaux réalisés — obligatoires pour transmettre les travaux</label>'
end = '</div><h4>Autres travaux</h4>'
start_index = text.find(start)
if start_index < 0:
    raise SystemExit("travaux photo section start not found")
end_index = text.find(end, start_index)
if end_index < 0:
    raise SystemExit("travaux photo section end not found")

new_photo_section = '''<div className="attachments-section" style={{marginTop:18}}><label>📷 Photos des travaux réalisés — obligatoires pour transmettre les travaux</label><div className="attachments-buttons"><button type="button" className="attachment-button" onClick={()=>document.getElementById("work-photo-camera-"+os.dbId)?.click()} disabled={!canEditWork}>📷 Prendre une photo</button><input id={"work-photo-camera-"+os.dbId} type="file" accept="image/*" capture="environment" style={{position:"absolute",width:1,height:1,opacity:0,pointerEvents:"none"}} onChange={(e)=>{const files=Array.from(e.target.files||[]).filter((file)=>file.type.startsWith("image/"));setWorkPhotoFiles((current)=>[...current,...files]);e.target.value="";}}/><button type="button" className="attachment-button" onClick={()=>document.getElementById("work-photo-library-"+os.dbId)?.click()} disabled={!canEditWork}>🖼️ Choisir une image dans Photos ou Fichiers</button><input id={"work-photo-library-"+os.dbId} type="file" accept="image/*" multiple style={{position:"absolute",width:1,height:1,opacity:0,pointerEvents:"none"}} onChange={(e)=>{const files=Array.from(e.target.files||[]).filter((file)=>file.type.startsWith("image/"));setWorkPhotoFiles((current)=>[...current,...files]);e.target.value="";}}/></div>{workPhotoFiles.length>0&&<div className="attachments-list">{workPhotoFiles.map((file,index)=><div className="attachment-item" key={file.name+"-"+file.lastModified+"-"+index}><LocalImagePreview file={file}/><span>{file.name}</span><button type="button" aria-label={"Retirer "+file.name} onClick={()=>setWorkPhotoFiles((current)=>current.filter((_,i)=>i!==index))}>×</button></div>)}</div>}<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:10}}><button className="secondary" type="button" disabled={workPhotoSaving||workPhotoFiles.length===0} onClick={()=>uploadWorkPhotos(os?.interventionId||null,true)}>{workPhotoSaving?"Enregistrement des photos...":"💾 Enregistrer les photos"}</button><span style={{fontSize:13,color:"#555"}}>Photos enregistrées : {travauxPhotos.length}</span></div></div>'''
text = text[:start_index] + new_photo_section + text[end_index:]

# Critical ordering fix: upload newly selected work photos before replacing
# work_realizations. The database guard may reject deleting/replacing realizations
# when no work photo exists yet, while uploadWorkPhotos creates the attachment.
old_order = '''      const {error:deleteRealizationsError}=await supabase.from("work_realizations").delete().eq("intervention_id",intervention.id);if(deleteRealizationsError)throw new Error("Erreur lors du remplacement des travaux réalisés : "+deleteRealizationsError.message);
      if(realizations.length>0){const {error:realizationError}=await supabase.from("work_realizations").insert(realizations);if(realizationError)throw new Error("Erreur lors de l'enregistrement des travaux réalisés : "+realizationError.message);}
      if(workPhotoFiles.length===0&&!attachments.some((file)=>file.category==="travaux_realises"&&file.mime_type?.startsWith("image/"))){alert("Transmission impossible : ajoutez au moins une photo des travaux réalisés.");return;}
      const photosSaved=await uploadWorkPhotos(intervention.id,false);if(!photosSaved)return;'''
new_order = '''      if(workPhotoFiles.length===0&&!attachments.some((file)=>file.category==="travaux_realises"&&file.mime_type?.startsWith("image/"))){alert("Transmission impossible : ajoutez au moins une photo des travaux réalisés.");return;}
      const photosSaved=await uploadWorkPhotos(intervention.id,false);if(!photosSaved)return;
      const {error:deleteRealizationsError}=await supabase.from("work_realizations").delete().eq("intervention_id",intervention.id);if(deleteRealizationsError)throw new Error("Erreur lors du remplacement des travaux réalisés : "+deleteRealizationsError.message);
      if(realizations.length>0){const {error:realizationError}=await supabase.from("work_realizations").insert(realizations);if(realizationError)throw new Error("Erreur lors de l'enregistrement des travaux réalisés : "+realizationError.message);}'''
if old_order in text:
    text = text.replace(old_order, new_order, 1)
elif new_order not in text:
    raise SystemExit("travaux transmission ordering block not found")

path.write_text(text, encoding="utf-8")

css = Path("src/style.css")
style = css.read_text(encoding="utf-8")
old_css = '.attachment-button input {\n  display: none;\n}'
new_css = '.attachment-button {\n  position: relative;\n  overflow: hidden;\n  touch-action: manipulation;\n}\n\n.attachment-button input {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  margin: 0;\n  opacity: 0;\n  display: block;\n  cursor: pointer;\n  z-index: 2;\n}'
if old_css in style:
    style = style.replace(old_css, new_css, 1)
css.write_text(style, encoding="utf-8")
