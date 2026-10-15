# Applies the critical Travaux transmission ordering fix before Vite build.
# New work photos must exist in attachments before work_realizations are replaced,
# otherwise the database guard can reject the DELETE/replace operation.
from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

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
