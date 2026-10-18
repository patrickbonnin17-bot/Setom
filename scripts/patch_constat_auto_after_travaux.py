from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

anchor = 'const {error:updateInterventionError}=await supabase.from("interventions").update({status:"Travaux effectués",actual_date:new Date().toISOString().slice(0,10),actual_surface_m2:totalActualSurface>0?totalActualSurface:null}).eq("id",intervention.id);if(updateInterventionError)throw new Error("Impossible de transmettre les travaux : "+updateInterventionError.message);'
insert = anchor + """\n      // Finalize the work-order status explicitly so the automatic constat does not depend on a database trigger.
      const {error:workOrderStatusError}=await supabase.from("work_orders").update({status:"Travaux effectués",updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",os.dbId);
      if(workOrderStatusError)throw new Error("Les travaux ont été enregistrés mais le statut de l'OS n'a pas pu passer à « Travaux effectués » : "+workOrderStatusError.message);
      // Regenerate the billing constat from the transmitted work data. A generation failure must not roll back the completed work transmission.
      const {data:generatedConstat,error:generateConstatError}=await supabase.rpc("regenerate_constat_for_work_order",{p_work_order_id:os.dbId,p_user_id:user.id});
      if(generateConstatError) console.error("Constat automatique non généré après transmission des travaux :",generateConstatError);
      if(generatedConstat?.constat) setConstat(generatedConstat.constat);
      if(Array.isArray(generatedConstat?.lines)) setConstatLines(generatedConstat.lines);"""

if 'status:"Travaux effectués",updated_by:user.id,updated_at:new Date().toISOString()' not in text:
    if anchor not in text:
        raise SystemExit("SETOM: automatic constat insertion anchor not found")
    text = text.replace(anchor, insert, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: work transmission now finalizes OS status and regenerates constat safely")
