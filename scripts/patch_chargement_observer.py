from pathlib import Path

path = Path("src/chargementNavigation.js")
text = path.read_text(encoding="utf-8")
old = 'const observer=new MutationObserver(()=>{ensureButton();if(!isChargement())restore()});'
new = '''const observer=new MutationObserver(mutations=>{
  const root=document.getElementById(ROOT_ID);
  if (root && mutations.some(m=>m.target===root || (m.target instanceof Node && root.contains(m.target)))) return;
  ensureButton();
  if(!isChargement())restore();
});'''
if old in text:
    text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("SETOM: Chargement observer loop guard applied")
