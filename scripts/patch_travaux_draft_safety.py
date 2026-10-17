from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

old = '''      const { error: deleteError } = await supabase.from("work_realizations").delete().eq("intervention_id", intervention.id);
      if (deleteError) throw deleteError;
      if (realizations.length) { const { error: insertError } = await supabase.from("work_realizations").insert(realizations); if (insertError) throw insertError; }
'''
new = '''      const { data: existingWorkPhotos, error: workPhotoReadError } = await supabase.from("attachments").select("id").eq("work_order_id", os.dbId).eq("category", "travaux_realises").like("mime_type", "image/%").limit(1);
      if (workPhotoReadError) throw workPhotoReadError;
      if (workPhotoFiles.length > 0) { const photosSaved = await uploadWorkPhotos(intervention.id, true); if (!photosSaved) return; }
      const hasWorkPhoto = workPhotoFiles.length > 0 || (existingWorkPhotos || []).length > 0;
      if (hasWorkPhoto) {
        const { error: deleteError } = await supabase.from("work_realizations").delete().eq("intervention_id", intervention.id);
        if (deleteError) throw deleteError;
        if (realizations.length) { const { error: insertError } = await supabase.from("work_realizations").insert(realizations); if (insertError) throw insertError; }
      }
'''
if old not in text:
    raise SystemExit("SETOM: draft realization block not found")
text = text.replace(old, new, 1)
old_photo = '      if (workPhotoFiles.length > 0) { const photosSaved = await uploadWorkPhotos(intervention.id, true); if (!photosSaved) return; }\n'
# Remove only the later duplicate. The earlier occurrence is now part of the replacement block.
first = text.find(old_photo)
second = text.find(old_photo, first + len(old_photo)) if first >= 0 else -1
if second >= 0:
    text = text[:second] + text[second + len(old_photo):]

path.write_text(text, encoding="utf-8")
print("SETOM: Travaux draft realization writes protected by photo rule")
