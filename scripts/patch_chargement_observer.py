from pathlib import Path

path = Path("src/chargementNavigation.js")
text = path.read_text(encoding="utf-8")

old_observer = 'const observer=new MutationObserver(()=>{ensureButton();if(!isChargement())restore()});'
new_observer = '''const observer=new MutationObserver(mutations=>{
  const root=document.getElementById(ROOT_ID);
  if (root && mutations.some(m=>m.target===root || (m.target instanceof Node && root.contains(m.target)))) return;
  ensureButton();
  if(!isChargement())restore();
});'''
if old_observer in text:
    text = text.replace(old_observer, new_observer, 1)

old_selected = 'const state=local;const selected=state.rows.find(r=>r.id===root.dataset.selected)||state.rows[0];const mat='
new_selected = '''const state=local;
  const pendingOrderId=root.dataset.pendingOrderId||window.__setomPendingChargementOrderId||"";
  if(pendingOrderId&&db.planned.length){
    const target=db.planned.find(p=>p.work_order_id===pendingOrderId);
    if(target){
      let targetRow=state.rows.find(r=>r.osId===target.id);
      if(!targetRow){
        const targetMaterial=byId(db.materials,target.order?.material_id)||byName(db.materials,target.order?.material_detail)||db.materials[0]||FALLBACK_MATERIALS[0];
        targetRow={id:`planning-${target.id}`,materialId:targetMaterial?.id||"",material:targetMaterial?.name||target.order?.material_detail||"",osId:target.id,planned:estimateTonnes(target,targetMaterial),loaded:"",used:""};
        state.rows=[...state.rows,targetRow];
        writeDay(date,state);
      }
      root.dataset.selected=targetRow.id;
      delete root.dataset.pendingOrderId;
      window.__setomPendingChargementOrderId="";
    }
  }
  const selected=state.rows.find(r=>r.id===root.dataset.selected)||state.rows[0];const mat='''
if old_selected in text:
    text = text.replace(old_selected, new_selected, 1)

old_tail = 'function boot(){ensureButton();styles();if(sessionStorage.getItem(SECTION_KEY)==="chargement"){window.__setomCurrentSection="chargement";render()}}'
new_tail = '''function handleChargementNavigation(event){
  const detail=event?.detail||{};
  if(detail.page!=="chargement") return;
  window.__setomCurrentSection="chargement";
  sessionStorage.setItem(SECTION_KEY,"chargement");
  if(detail.orderId) window.__setomPendingChargementOrderId=String(detail.orderId);
  const root=document.getElementById(ROOT_ID);
  if(root){
    root.dataset.date=detail.date||root.dataset.date||today();
    root.dataset.loaded="0";
    if(detail.orderId) root.dataset.pendingOrderId=String(detail.orderId);
  }
  render();
}
window.addEventListener("setom:navigate",handleChargementNavigation);
function boot(){ensureButton();styles();if(sessionStorage.getItem(SECTION_KEY)==="chargement"){window.__setomCurrentSection="chargement";render()}}'''
if old_tail in text:
    text = text.replace(old_tail, new_tail, 1)

path.write_text(text, encoding="utf-8")
print("SETOM: Chargement navigation bridge applied")
