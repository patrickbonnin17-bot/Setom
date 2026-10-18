from pathlib import Path

p = Path("src/chargementMaterialLedger.js")
s = p.read_text(encoding="utf-8")

old = '''let timer;
async function refresh(){ const root=document.getElementById(ROOT_ID); if(!root) return; const date=root.dataset.date || sessionStorage.getItem("setom:chargement:date:v1") || new Date().toISOString().slice(0,10); const items=await load(date); render(root,date,items); }
if(typeof window!=="undefined"){ window.setomRefreshMaterialLedger=refresh; window.addEventListener("setom:chargement-date-changed",()=>refresh()); const observer=new MutationObserver(()=>{ clearTimeout(timer); timer=setTimeout(refresh,250); }); observer.observe(document.body,{childList:true,subtree:true}); setTimeout(refresh,300); }
'''
new = '''let timer;
let mountedRoot = null;
let refreshInFlight = false;
async function refresh(){
  if (refreshInFlight) return;
  const root=document.getElementById(ROOT_ID);
  if(!root) return;
  const date=root.dataset.date || sessionStorage.getItem("setom:chargement:date:v1") || new Date().toISOString().slice(0,10);
  refreshInFlight = true;
  try {
    const items=await load(date);
    render(root,date,items);
  } finally {
    refreshInFlight = false;
  }
}
if(typeof window!=="undefined"){
  window.setomRefreshMaterialLedger=refresh;
  window.addEventListener("setom:chargement-date-changed",(event)=>{
    const root=document.getElementById(ROOT_ID);
    if(root && event?.detail?.date) root.dataset.date=event.detail.date;
    refresh();
  });
  const observer=new MutationObserver(()=>{
    const root=document.getElementById(ROOT_ID);
    if(!root || root === mountedRoot) return;
    mountedRoot = root;
    clearTimeout(timer);
    timer=setTimeout(refresh,150);
  });
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>{
    const root=document.getElementById(ROOT_ID);
    if(root) mountedRoot=root;
    refresh();
  },300);
}
'''
if old not in s:
    if "let mountedRoot = null;" in s and "let refreshInFlight = false;" in s:
        print("SETOM: material ledger observer already mutation-safe")
        raise SystemExit(0)
    raise SystemExit("SETOM: material ledger observer block not found")
s=s.replace(old,new,1)
p.write_text(s,encoding="utf-8")
print("SETOM: material ledger observer made mutation-safe")
