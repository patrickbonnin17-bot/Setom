from pathlib import Path

path = Path("src/travauxMaterialOverlay.js")
s = path.read_text(encoding="utf-8")

if "SETOM: material consumption upsert" in s:
    print("SETOM: material consumption upsert already applied")
    raise SystemExit(0)

old = '''      if (actualValue > 0) {
        const { error } = await supabase.from("truck_material_consumptions").insert({ work_order_id: ctx.os.id, intervention_id: ctx.intervention.id, material_id: ctx.material.id, consumption_date: ctx.date, quantity: actualValue, unit: "t", estimated: false, source: "travaux_reels", created_by: userId });
        if (error) throw error;
      }
'''

new = '''      if (actualValue > 0) {
        // Une seule consommation est autorisée par OS / matériau / journée.
        // On met donc à jour la ligne existante au lieu de provoquer une violation
        // de la contrainte unique truck_material_consumptions_*_key.
        const { data: existingConsumption, error: readConsumptionError } = await supabase
          .from("truck_material_consumptions")
          .select("id")
          .eq("work_order_id", ctx.os.id)
          .eq("material_id", ctx.material.id)
          .eq("consumption_date", ctx.date)
          .maybeSingle();
        if (readConsumptionError) throw readConsumptionError;

        const payload = {
          work_order_id: ctx.os.id,
          intervention_id: ctx.intervention.id,
          material_id: ctx.material.id,
          consumption_date: ctx.date,
          quantity: actualValue,
          unit: "t",
          estimated: false,
          source: "travaux_reels",
          created_by: userId,
          updated_at: new Date().toISOString()
        };

        if (existingConsumption?.id) {
          const { error } = await supabase
            .from("truck_material_consumptions")
            .update(payload)
            .eq("id", existingConsumption.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("truck_material_consumptions")
            .insert(payload);
          if (error) throw error;
        }
      }
'''

if old not in s:
    raise SystemExit("SETOM: material consumption save block not found")

s = s.replace(old, new, 1)
s += "\n// SETOM: material consumption upsert\n"
path.write_text(s, encoding="utf-8")
print("SETOM: material consumption duplicate protection applied")
