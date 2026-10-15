from pathlib import Path

p = Path("src/main.jsx")
s = p.read_text(encoding="utf-8")

marker = '''      const {error:updateInterventionError}=await supabase.from("interventions").update({status:"Travaux effectués",actual_date:new Date().toISOString().slice(0,10),actual_surface_m2:totalActualSurface>0?totalActualSurface:null}).eq("id",intervention.id);if(updateInterventionError)throw new Error("Impossible de transmettre les travaux : "+updateInterventionError.message);'''

replacement = marker + '''
      // Synchroniser explicitement le statut de l'OS avec l'intervention.
      // Cela évite qu'une transmission réussie reste affichée comme "Planifié"
      // ou "Travaux en cours" lorsque le trigger de synchronisation n'est pas disponible.
      const {data:currentOrder,error:currentOrderError}=await supabase.from("work_orders").select("status").eq("id",os.dbId).single();
      if(currentOrderError)throw new Error("Impossible de vérifier le statut de l'OS : "+currentOrderError.message);
      if(currentOrder?.status === "Planifié"){
        const {error:moveToInProgressError}=await supabase.from("work_orders").update({status:"Travaux en cours",updated_by:user.id}).eq("id",os.dbId);
        if(moveToInProgressError)throw new Error("Impossible de passer l'OS en travaux : "+moveToInProgressError.message);
      }
      const {error:moveToRealizedError}=await supabase.from("work_orders").update({status:"Travaux réalisés",updated_by:user.id}).eq("id",os.dbId);
      if(moveToRealizedError)throw new Error("Impossible de mettre l'OS en travaux réalisés : "+moveToRealizedError.message);
      const {error:moveToConstatError}=await supabase.from("work_orders").update({status:"Constat à vérifier",updated_by:user.id}).eq("id",os.dbId);
      if(moveToConstatError)throw new Error("Impossible de préparer le constat : "+moveToConstatError.message);'''

if marker not in s:
    raise SystemExit("Transmission marker not found; no changes made")
if 'Synchroniser explicitement le statut de l\'OS avec l\'intervention.' in s:
    raise SystemExit("Patch already present")

p.write_text(s.replace(marker, replacement, 1), encoding="utf-8")
print("Transmission status synchronization patch applied")
