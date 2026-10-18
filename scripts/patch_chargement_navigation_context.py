from pathlib import Path

path = Path("src/chargementNavigation.js")
text = path.read_text(encoding="utf-8")

old_date = 'const date=root.dataset.date||today();root.dataset.date=date;const db=await loadDay(date);const local=readDay(date);if(root.dataset.loaded!=="1"){local.rows=rowsFromDb(local,db.loads,db.consumptions,db.materials,db.planned);if(!local.team&&db.planned[0]?.teamName)local.team=db.planned[0].teamName;root.dataset.loaded="1"}'
new_date = '''const storedDate=(()=>{try{const value=sessionStorage.getItem("setom:chargement:date:v1")||localStorage.getItem("setom:chargement:date:v1")||"";return /^\\d{4}-\\d{2}-\\d{2}$/.test(value)?value:""}catch(_){return ""}})();
  const date=root.dataset.date||storedDate||today();root.dataset.date=date;const db=await loadDay(date);const local=readDay(date);if(root.dataset.loaded!=="1"){local.rows=rowsFromDb(local,db.loads,db.consumptions,db.materials,db.planned);if(!local.team&&db.planned[0]?.teamName)local.team=db.planned[0].teamName;try{const targetOrder=sessionStorage.getItem("setom:chargement:order:v1")||"";const target=db.planned.find(p=>p.work_order_id===targetOrder);if(target){const targetRow=local.rows.find(r=>r.osId===target.id);if(targetRow)root.dataset.selected=targetRow.id;}sessionStorage.removeItem("setom:chargement:order:v1")}catch(_){ }root.dataset.loaded="1"}'''
if old_date in text and 'const storedDate=(()=>{try{const value=sessionStorage.getItem("setom:chargement:date:v1")' not in text:
    text = text.replace(old_date, new_date, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: chargement now consumes planning date and selected OS context")
