from pathlib import Path

path = Path("src/chargementNavigation.js")
text = path.read_text(encoding="utf-8")

marker = 'const STORAGE_KEY = "setom:chargement:v2";\n'
insert = marker + 'const ENROBE_THICKNESS_CM = 6;\nconst ENROBE_DENSITY_T_M3 = 2.35;\nconst ENROBE_TONNES_PER_M2 = ENROBE_THICKNESS_CM / 100 * ENROBE_DENSITY_T_M3;\n'
if 'ENROBE_TONNES_PER_M2' not in text:
    if marker not in text:
        raise SystemExit("SETOM: chargement constants marker not found")
    text = text.replace(marker, insert, 1)

old = '''  const plannedMap = new Map([...plannedMaterials.values()].map(x=>[x.material,x]));
  for (const r of rows) { if (r.material && !r.planned && plannedMap.has(r.material)) r.planned = ""; }
'''
new = '''  const plannedMap = new Map([...plannedMaterials.values()].map(x=>[x.material,x]));
  for (const r of rows) {
    if (!r.material || !plannedMap.has(r.material)) continue;
    const p = plannedMap.get(r.material);
    if (!r.planned && /enrob/i.test(r.material)) r.planned = (p.surface * ENROBE_TONNES_PER_M2).toFixed(2);
    if (!r.used && /enrob/i.test(r.material) && p.usedM3 > 0) r.used = (p.usedM3 * ENROBE_DENSITY_T_M3).toFixed(2);
  }
'''
if old not in text:
    raise SystemExit("SETOM: planned material mapping block not found")
text = text.replace(old, new, 1)

old_note = 'Les tonnages réellement chargés et les corrections saisies sont conservés par journée sur cet appareil. Le planning du jour est relu depuis Supabase à l’actualisation.'
new_note = 'Référence enrobé : 6 cm × 2,35 t/m³ = 0,141 t/m². Les tonnages réellement chargés et les corrections saisies sont conservés par journée sur cet appareil. Le planning du jour est relu depuis Supabase à l’actualisation.'
if old_note in text:
    text = text.replace(old_note, new_note, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: enrobe reference applied to Chargement")
