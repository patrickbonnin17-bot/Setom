from pathlib import Path

p=Path('src/profitabilityOverlay.js')
s=p.read_text(encoding='utf-8')
marker='// SETOM: profitability cost breakdown fixed'
if marker in s:
    raise SystemExit(0)
old='''directOtherCost=osCosts.reduce((sum,x)=>sum+num(x.amount),0),laborCost=osCosts.filter(x=>/main|salair|personnel|heures|heure/i.test(`${x.category||""} ${x.description||""}`)).reduce((sum,x)=>sum+num(x.amount),0),ca=num(c?.total_amount)'''
new='''laborCost=osCosts.filter(x=>/main|salair|personnel|heures|heure/i.test(`${x.category||""} ${x.description||""}`)).reduce((sum,x)=>sum+num(x.amount),0),directOtherCost=osCosts.filter(x=>!/main|salair|personnel|heures|heure/i.test(`${x.category||""} ${x.description||""}`)).reduce((sum,x)=>sum+num(x.amount),0),ca=num(c?.total_amount)'''
if old not in s:
    raise SystemExit('cost breakdown source pattern not found')
s=s.replace(old,new,1)
s=s.replace('directCost=materialCost+directOtherCost,margin=ca-directCost','directCost=materialCost+laborCost+directOtherCost,margin=ca-directCost',1)
s=s.replace('''<div class="pr-card"><div class="pr-label">Coût matériaux</div><div class="pr-value">${euro(totals.material)}</div></div><div class="pr-card"><div class="pr-label">Autres coûts directs</div>''','''<div class="pr-card"><div class="pr-label">Coût matériaux</div><div class="pr-value">${euro(totals.material)}</div></div><div class="pr-card"><div class="pr-label">Main-d’œuvre</div><div class="pr-value">${euro(filtered.reduce((s,r)=>s+r.laborCost,0))}</div></div><div class="pr-card"><div class="pr-label">Autres coûts directs</div>''',1)
s += '\n'+marker+'\n'
p.write_text(s,encoding='utf-8')
print('SETOM: profitability cost breakdown fixed')
