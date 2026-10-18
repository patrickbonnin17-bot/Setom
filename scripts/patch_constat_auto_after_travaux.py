from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")

anchor = 'const {error:updateInterventionError}=await supabase.from("interventions").update({status:"Travaux effectués",actual_date:new Date().toISOString().slice(0,10),actual_surface_m2:totalActualSurface>0?totalActualSurface:null}).eq("id",intervention.id);if(updateInterventionError)throw new Error("Impossible de transmettre les travaux : "+updateInterventionError.message);'
insert = anchor + '\n      // Always regenerate the billing constat from the transmitted work data. This keeps the automatic constat reliable even when a database trigger is unavailable or delayed.\n      const {data:generatedConstat,error:generateConstatError}=await supabase.rpc("regenerate_constat_for_work_order",{p_work_order_id:os.dbId,p_user_id:user.id});\n      if(generateConstatError)throw new Error("Les travaux sont enregistrés mais le constat automatique n'a pas pu être généré : "+generateConstatError.message);\n      if(generatedConstat?.constat) setConstat(generatedConstat.constat);\n      if(Array.isArray(generatedConstat?.lines)) setConstatLines(generatedConstat.lines);'
if 'regenerate_constat_for_work_order",{p_work_order_id:os.dbId,p_user_id:user.id}' not in text:
    if anchor not in text:
        raise SystemExit("SETOM: automatic constat insertion anchor not found")
    text = text.replace(anchor, insert, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: automatic constat regeneration wired after Travaux transmission")