from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

# A draft of the real measurements must be persistable even when the field team
# has not attached a photo yet. Photos remain required for final transmission,
# but they must not gate the measurement draft itself.
protected = '''      const { data: existingWorkPhotos, error: workPhotoReadError } = await supabase.from("attachments").select("id").eq("work_order_id", os.dbId).eq("category", "travaux_realises").like("mime_type", "image/%").limit(1);
      if (workPhotoReadError) throw workPhotoReadError;
      if (workPhotoFiles.length > 0) { const photosSaved = await uploadWorkPhotos(intervention.id, true); if (!photosSaved) return; }
      const hasWorkPhoto = workPhotoFiles.length > 0 || (existingWorkPhotos || []).length > 0;
      if (hasWorkPhoto) {
        const { error: deleteError } = await supabase.from("work_realizations").delete().eq("intervention_id", intervention.id);
        if (deleteError) throw deleteError;
        if (realizations.length) { const { error: insertError } = await supabase.from("work_realizations").insert(realizations); if (insertError) throw insertError; }
      }
'''
normal = '''      const { error: deleteError } = await supabase.from("work_realizations").delete().eq("intervention_id", intervention.id);
      if (deleteError) throw deleteError;
      if (realizations.length) { const { error: insertError } = await supabase.from("work_realizations").insert(realizations); if (insertError) throw insertError; }
'''

if protected in text:
    text = text.replace(protected, normal, 1)

# Do not remove the normal photo upload later in saveWorkDraft().
path.write_text(text, encoding="utf-8")
print("SETOM: Travaux drafts now persist measurements independently of photos")
