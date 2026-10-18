from pathlib import Path

p = Path("src/travauxMaterialOverlay.js")
s = p.read_text(encoding="utf-8")
old = '''  const displayedActual = ctx.currentConsumption?.quantity || estimated;'''
new = '''  const displayedActual = ctx.currentConsumption?.quantity ?? estimated;'''
if old in s:
    s = s.replace(old, new, 1)
old = '''      if (loadValue > 0) {\n        if (ctx.load?.id) {'''
new = '''      if (ctx.load?.id) {'''
if old in s:
    s = s.replace(old, new, 1)
old = '''        } else {\n          const { error } = await supabase.from("truck_daily_loads").insert({ load_date: ctx.date, material_id: ctx.material.id, loaded_quantity: loadValue, unit: "t", created_by: userId });\n          if (error) throw error;\n        }\n      }'''
new = '''      } else if (loadValue > 0) {\n        const { error } = await supabase.from("truck_daily_loads").insert({ load_date: ctx.date, material_id: ctx.material.id, loaded_quantity: loadValue, unit: "t", created_by: userId });\n        if (error) throw error;\n      }'''
if old in s:
    s = s.replace(old, new, 1)
old = '''      if (actualValue > 0) {\n        const payload = { work_order_id: ctx.os.id, intervention_id: ctx.intervention.id, material_id: ctx.material.id, consumption_date: ctx.date, quantity: actualValue, unit: "t", estimated: false, source: "travaux_reels", created_by: userId, updated_at: new Date().toISOString() };\n        if (ctx.currentConsumption?.id) {\n          const { error } = await supabase.from("truck_material_consumptions").update(payload).eq("id", ctx.currentConsumption.id);\n          if (error) throw error;\n        } else {\n          const { error } = await supabase.from("truck_material_consumptions").insert(payload);\n          if (error) throw error;\n        }\n      }'''
new = '''      if (ctx.currentConsumption?.id) {\n        const payload = { quantity: actualValue, unit: "t", estimated: false, source: "travaux_reels", updated_at: new Date().toISOString() };\n        const { error } = await supabase.from("truck_material_consumptions").update(payload).eq("id", ctx.currentConsumption.id);\n        if (error) throw error;\n      } else if (actualValue > 0) {\n        const payload = { work_order_id: ctx.os.id, intervention_id: ctx.intervention.id, material_id: ctx.material.id, consumption_date: ctx.date, quantity: actualValue, unit: "t", estimated: false, source: "travaux_reels", created_by: userId, updated_at: new Date().toISOString() };\n        const { error } = await supabase.from("truck_material_consumptions").insert(payload);\n        if (error) throw error;\n      }'''
if old in s:
    s = s.replace(old, new, 1)
marker = "// SETOM: allow zeroing material quantities"
if marker not in s:
    s += "\n" + marker + "\n"
p.write_text(s, encoding="utf-8")
print("SETOM: material quantities can be corrected to zero")
