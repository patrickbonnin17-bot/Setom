from pathlib import Path

path = Path("src/chargementNavigation.js")
text = path.read_text(encoding="utf-8")

if "setom-chargement-reverse-nav-v2" not in text:
    marker = 'function styles(){'
    helper = '''function installReverseNavigation(root){
  if(!root||root.dataset.reverseNavInstalled==="1")return;
  root.dataset.reverseNavInstalled="1";
  const style=document.createElement("style");
  style.id="setom-chargement-reverse-nav-v2";
  style.textContent=`.s3-reverse-nav{display:flex;gap:7px;flex-wrap:wrap;margin:0 11px 11px;padding:10px;border:1px solid #2d5263;border-radius:12px;background:#0a1d29}.s3-reverse-nav button{border:1px solid #3d6070;background:#102d3b;color:#eef7fa;border-radius:8px;padding:8px 11px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.s3-reverse-nav button.primary{background:#0d9e4d;border-color:#2bd77a}.s3-reverse-nav .label{display:flex;align-items:center;margin-right:auto;color:#91aab6;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}`;
  document.head.appendChild(style);
  const readOrderId=()=>{
    try{return String(sessionStorage.getItem("setom:chargement:order:v1")||localStorage.getItem("setom:chargement:order:v1")||"").trim()}catch(_){return ""}
  };
  const sync=()=>{
    const current=root.querySelector(".s3-os-item.active")||root.querySelector(".s3-os-item");
    let bar=root.querySelector(".s3-reverse-nav");
    if(!current){bar?.remove();return;}
    if(!bar){bar=document.createElement("div");bar.className="s3-reverse-nav";root.appendChild(bar)}
    const strong=current.querySelector("strong");
    const osNumber=String(strong?.textContent||"").replace(/\\s*·\\s*OS sélectionné\\s*$/i,"").trim();
    const orderId=String(current.dataset.orderId||current.dataset.workOrderId||readOrderId()).trim();
    bar.innerHTML=`<span class="label">OS sélectionnée : ${esc(osNumber||"—")}</span><button type="button" class="primary" data-setom-open-os>Ouvrir le dossier OS</button><button type="button" data-setom-open-travaux>Accéder aux travaux</button>`;
    const open=(page)=>{
      if(!orderId&&!osNumber)return;
      window.dispatchEvent(new CustomEvent("setom:navigate",{detail:{page,orderId,osNumber,date:root.dataset.date||today()}}));
    };
    bar.querySelector("[data-setom-open-os]")?.addEventListener("click",()=>open("os"));
    bar.querySelector("[data-setom-open-travaux]")?.addEventListener("click",()=>open("travaux"));
  };
  const observer=new MutationObserver(()=>requestAnimationFrame(sync));
  observer.observe(root,{childList:true,subtree:true});
  root.addEventListener("click",event=>{
    if(event.target.closest(".s3-os-item"))requestAnimationFrame(sync);
  });
  requestAnimationFrame(sync);
}

'''
    if marker not in text:
        raise SystemExit("chargement styles marker not found")
    text=text.replace(marker,helper+marker,1)

needle='styles();'
if 'installReverseNavigation(root);' not in text:
    if needle not in text:
        raise SystemExit("chargement styles() call not found")
    text=text.replace(needle,needle+'\n  installReverseNavigation(root);',1)

path.write_text(text,encoding="utf-8")
print("SETOM: reverse navigation preserves work-order context")
