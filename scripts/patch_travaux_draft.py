from pathlib import Path
import re

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

if "async function saveWorkDraft()" not in text:
    anchor = "  async function save() {"
    if anchor not in text:
        raise SystemExit("SETOM: save() anchor not found")
    draft = r'''  async function saveWorkDraft() {
    if (!os?.dbId) return;
    if (!["admin", "bureau", "equipe_terrain"].includes(profile?.role)) { alert("Vous n'avez pas les droits pour enregistrer les travaux."); return; }
    if (!["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"].includes(os?.status)) { alert("Cet OS est verrouillé pour la saisie des travaux."); return; }
    try {
      const { data: authData, error: userError } = await supabase.auth.getUser();
      const user = authData?.user;
      if (userError || !user) throw new Error("Utilisateur non connecté.");
      let { data: intervention, error: interventionError } = await supabase.from("interventions").select("id, work_order_id, type, status, planned_surface_m2, actual_surface_m2").eq("work_order_id", os.dbId).maybeSingle();
      if (interventionError) throw interventionError;
      if (!intervention) {
        const { data: created, error: createError } = await supabase.from("interventions").insert({ work_order_id: os.dbId, type: os.intervention || os.work || "Intervention", status: os.status || "Planifié", planned_surface_m2: Number(String(os.quantity || "").replace(" m²", "").replace(",", ".")) || null, planned_date: os.plannedDate || null, actual_surface_m2: null }).select("id, work_order_id, type, status, planned_surface_m2, actual_surface_m2").single();
        if (createError) throw createError;
        intervention = created;
      }
      const roadActual = realRoadSurface !== "" && !isNaN(Number(realRoadSurface)) ? Number(realRoadSurface) : 0;
      const sidewalkActual = realSidewalkSurface !== "" && !isNaN(Number(realSidewalkSurface)) ? Number(realSidewalkSurface) : 0;
      const otherActual = realOtherSurface !== "" && !isNaN(Number(realOtherSurface)) ? Number(realOtherSurface) : 0;
      const genericActual = realSurface !== "" && !isNaN(Number(realSurface)) ? Number(realSurface) : 0;
      const totalActualSurface = os.rehabilitationZone === "Chaussée + trottoir" ? roadActual + sidewalkActual : os.rehabilitationZone === "Chaussée" ? roadActual : os.rehabilitationZone === "Trottoir" ? sidewalkActual : os.rehabilitationZone === "Autre" ? otherActual : genericActual;
      const plannedSurface = Number(String(os.quantity || "").replace(" m²", "").replace(",", ".")) || 0;
      const automaticDemolition = Math.max(0, totalActualSurface - plannedSurface);
      const realizations = [];
      if (totalActualSurface > 0) realizations.push({ intervention_id: intervention.id, designation: os.intervention || os.work || "Travaux réalisés", quantity: totalActualSurface, unit: "m²", surface_m2: totalActualSurface, thickness_cm: thickness !== "" && !isNaN(Number(thickness)) ? Number(thickness) : null, observations: workComment || null });
      if (sciage !== "" && !isNaN(Number(sciage))) realizations.push({ intervention_id: intervention.id, designation: "Sciage", quantity: Number(sciage), unit: "ml", length_ml: Number(sciage) });
      if (joints !== "" && !isNaN(Number(joints))) realizations.push({ intervention_id: intervention.id, designation: "Joints", quantity: Number(joints), unit: "ml", length_ml: Number(joints) });
      if (boucheAcle !== "" && !isNaN(Number(boucheAcle))) realizations.push({ intervention_id: intervention.id, designation: "Bouché à clé", quantity: Number(boucheAcle), unit: "U" });
      if (automaticDemolition > 0) realizations.push({ intervention_id: intervention.id, designation: "Démolition", quantity: automaticDemolition, unit: "m²", surface_m2: automaticDemolition });
      if (circulationType && circulationHours !== "" && !isNaN(Number(circulationHours)) && Number(circulationHours) > 0) { const designation = circulationType === "K10" ? "Circulation alternée manuelle par 2 agents munis de panneaux K10" : "Circulation alternée par 2 feux tricolores à batterie synchronisés, y compris la présignalisation, l'entretien et la surveillance des feux"; realizations.push({ intervention_id: intervention.id, designation, quantity: Number(circulationHours) / 4, unit: "1/2 j", observations: Number(circulationHours) + " h" }); }
      if (marquageSurface !== "" && !isNaN(Number(marquageSurface)) && Number(marquageSurface) > 0) realizations.push({ intervention_id: intervention.id, designation: "Marquage", quantity: Number(marquageSurface), unit: "m²", surface_m2: Number(marquageSurface) });
      const { error: deleteError } = await supabase.from("work_realizations").delete().eq("intervention_id", intervention.id);
      if (deleteError) throw deleteError;
      if (realizations.length) { const { error: insertError } = await supabase.from("work_realizations").insert(realizations); if (insertError) throw insertError; }
      const { error: workOrderError } = await supabase.from("work_orders").update({ actual_road_surface_m2: os.rehabilitationZone === "Chaussée" || os.rehabilitationZone === "Chaussée + trottoir" ? (roadActual || null) : null, actual_sidewalk_surface_m2: os.rehabilitationZone === "Trottoir" || os.rehabilitationZone === "Chaussée + trottoir" ? (sidewalkActual || null) : null, actual_other_surface_m2: os.rehabilitationZone === "Autre" ? (otherActual || null) : null, updated_by: user.id }).eq("id", os.dbId);
      if (workOrderError) throw workOrderError;
      const { error: interventionUpdateError } = await supabase.from("interventions").update({ actual_surface_m2: totalActualSurface > 0 ? totalActualSurface : null }).eq("id", intervention.id);
      if (interventionUpdateError) throw interventionUpdateError;
      if (workPhotoFiles.length > 0) { const photosSaved = await uploadWorkPhotos(intervention.id, true); if (!photosSaved) return; }
      onUpdate(os.id, { actualRoadSurface: roadActual || null, actualSidewalkSurface: sidewalkActual || null, actualOtherSurface: otherActual || null, interventionId: intervention.id });
      alert("✅ Brouillon des travaux enregistré. Le statut de l'OS n'a pas été modifié.");
    } catch (error) { console.error("Erreur enregistrement brouillon travaux :", error); alert("Impossible d'enregistrer le brouillon des travaux :\n\n" + (error?.message || "Erreur inconnue")); }
  }

'''
    text = text.replace(anchor, draft + anchor, 1)

if "onClick={saveWorkDraft}" not in text:
    old = r'<div className="work-actions">{\["admin","bureau","equipe_terrain"\]\.includes\(profile\?\.role\) && \["Planifié","Travaux en cours","Travaux réalisés"\]\.includes\(os\?\.status\) && <button className="primary" type="button" onClick=\{save\}>✅ Transmettre les travaux réalisés</button>}\{!\["Planifié","Travaux en cours","Travaux réalisés"\]\.includes\(os\?\.status\) && <span style=\{\{ color: "#667085", fontSize: 13 \}\}>Les travaux ne peuvent plus être transmis depuis ce statut\.</span>\}</div>'
    new = '<div className="work-actions">{["admin","bureau","equipe_terrain"].includes(profile?.role) && ["Nouveau","À planifier","Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status) && <div className="work-action-row"><button className="secondary" type="button" onClick={saveWorkDraft}>💾 Enregistrer les mesures</button>{["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status) && <button className="primary" type="button" onClick={save}>✅ Transmettre les travaux réalisés</button>}</div>}{!["Planifié","En travaux","Travaux en cours","Travaux réalisés"].includes(os?.status) && <span style={{ color: "#667085", fontSize: 13 }}>Les travaux peuvent être enregistrés en brouillon ; la transmission sera disponible après planification.</span>}</div>'
    text, count = re.subn(old, new, text, count=1)
    if count != 1:
        raise SystemExit("SETOM: Travaux action block not found")

path.write_text(text, encoding="utf-8")
print("SETOM: Travaux draft save added")
