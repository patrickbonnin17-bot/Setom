from pathlib import Path

path = Path("src/main.jsx")
text = path.read_text(encoding="utf-8")
marker = 'import "./chargementNavigation";\n'
if marker not in text:
    text = marker + text
path.write_text(text, encoding="utf-8")

nav = Path("src/chargementNavigation.js")
r = nav.read_text(encoding="utf-8")

anchor = 'const today=()=>new Date().toISOString().slice(0,10);'
replacement = '''const today=()=>new Date().toISOString().slice(0,10);
const contextDate=()=>{
  try{
    const value=sessionStorage.getItem("setom:chargement:date:v1")||localStorage.getItem("setom:chargement:date:v1")||"";
    return /^\\d{4}-\\d{2}-\\d{2}$/.test(value)?value:today();
  }catch(_){return today();}
};'''
if anchor in r and 'const contextDate=' not in r:
    r = r.replace(anchor, replacement, 1)

r = r.replace('const date=root.dataset.date||today();', 'const date=root.dataset.date||contextDate();', 1)

if 'setom:chargement-date-changed' not in r:
    marker = 'const observer=new MutationObserver('
    handler = '''window.addEventListener("setom:chargement-date-changed", event=>{
  const date=String(event?.detail?.date||contextDate()).trim();
  const root=document.getElementById(ROOT_ID);
  if(!root||!/^\\d{4}-\\d{2}-\\d{2}$/.test(date))return;
  root.dataset.date=date;
  root.dataset.loaded="0";
  render();
});

'''
    if marker in r:
        r = r.replace(marker, handler + marker, 1)

path.write_text(text, encoding="utf-8")
nav.write_text(r, encoding="utf-8")
print("SETOM: chargement navigation consumes planning date context")
