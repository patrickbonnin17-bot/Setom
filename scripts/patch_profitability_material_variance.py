from pathlib import Path
import re

p = Path("src/profitabilityOverlay.js")
s = p.read_text(encoding="utf-8")
marker = "// SETOM: material cost variance by OS"
if marker in s:
    print("SETOM: material cost variance already applied")
    raise SystemExit(0)

# The profitability source already computes real consumed tonnes. Enrich that
# same OS row with planned-vs-real material variance without changing CA rules.
if "materialQuantityVariance" not in s:
    pattern = r'(consumedTonnes=xs\.reduce\(\(sum,x\)=>sum\+\(String\(x\.unit\|\|\"\"\)\.toLowerCase\(\)===\"t\"\?num\(x\.quantity\):0\),0\),)'
    replacement = r'\1plannedMaterialTonnes=num(i?.planned_tonnage||o.planned_tonnage||o.estimated_tonnage),materialQuantityVariance=consumedTonnes-plannedMaterialTonnes,materialQuantityVariancePct=plannedMaterialTonnes>0?(materialQuantityVariance/plannedMaterialTonnes)*100:null,'
    s, count = re.subn(pattern, replacement, s, count=1)
    if count == 0:
        print("SETOM: profitability variance insertion point not found")
        raise SystemExit(0)

# Add fields to the OS object returned by loadProfitability().
s = s.replace('marginPct:ca>0?margin/ca*100:null,consumedTonnes,', 'marginPct:ca>0?margin/ca*100:null,consumedTonnes,plannedMaterialTonnes,materialQuantityVariance,materialQuantityVariancePct,', 1)

# Make the variance visible in the OS table. Keep the existing financial columns intact.
if "Écart matière" not in s and '<th>Tonnage</th>' in s:
    s = s.replace('<th>Tonnage</th><th>CA accepté</th>', '<th>Tonnage</th><th>Prévu matière</th><th>Écart matière</th><th>CA accepté</th>', 1)
    old = '<td class="num">${r.consumedTonnes.toFixed(2)} t</td><td class="num">${euro(r.ca)}</td>'
    new = '<td class="num">${r.consumedTonnes.toFixed(2)} t</td><td class="num">${r.plannedMaterialTonnes>0?r.plannedMaterialTonnes.toFixed(2)+" t":"—"}</td><td class="num ${Math.abs(r.materialQuantityVariancePct||0)>5?"pr-negative":""}">${r.plannedMaterialTonnes>0?(r.materialQuantityVariance>=0?"+":"")+r.materialQuantityVariance.toFixed(2)+" t · "+(r.materialQuantityVariancePct>=0?"+":"")+r.materialQuantityVariancePct.toFixed(1)+" %":"—"}</td><td class="num">${euro(r.ca)}</td>'
    s = s.replace(old, new, 1)

s += "\n" + marker + "\n"
p.write_text(s, encoding="utf-8")
print("SETOM: material cost variance by OS applied")
