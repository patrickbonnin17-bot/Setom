import { supabase } from "./supabase";

const ROOT="setom-materials-finance-widget";
const esc=v=>String(v??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=v=>`${Number(v||0).toFixed(2)} €`;
let running=false;

async function apply(){
  if(running)return;
  const panel=document.getElementById(`${ROOT}-panel`);
  if(!panel)return;
  const date=panel.querySelector("#mf-date")?.value;
  if(!date)return;
  running=true;
  try{
    const [{data:cons,error:ce},{data:loads,error:le},{data:mats,error:me}]=await Promise.all([
      supabase.from("truck_material_consumptions").select("work_order_id,material_id,quantity,estimated").eq("consumption_date",date),
      supabase.from("truck_daily_loads").select("material_id,loaded_quantity").eq("load_date",date),
      supabase.from("materials").select("id,name,purchase_price_per_t")
    ]);
    if(ce)throw ce;if(le)throw le;if(me)throw me;
    const actual=new Set((cons||[]).filter(x=>x.estimated===false).map(x=>`${x.work_order_id}:${x.material_id}`));
    const loadMap=new Map((loads||[]).map(x=>[x.material_id,Number(x.loaded_quantity||0)]));
    const matMap=new Map((mats||[]).map(x=>[x.id,x]));

    const table=panel.querySelector(".mf-table");
    if(table){
      const head=table.querySelector("thead tr");
      if(head && !head.querySelector(".mf-state-head"))head.insertAdjacentHTML("beforeend",`<th class="mf-state-head">Statut</th>`);
      table.querySelectorAll("tbody tr").forEach(tr=>{
        if(tr.children.length<7)return;
        const save=tr.querySelector("[data-save]");
        if(!save)return;
        const rowId=save.getAttribute("data-save");
        const actualRow=(cons||[]).find(x=>x.work_order_id===rowId&&x.estimated===false);
        const cell=tr.querySelector(".mf-state-cell")||tr.insertCell(-1);
        cell.className="mf-state-cell";
        cell.innerHTML=actualRow?`<strong class="mf-good">RÉEL</strong>`:`<strong style="color:#b54708">ESTIMÉ</strong><div class="mf-muted">Saisir le consommé pour fiabiliser la marge</div>`;
      });
    }

    panel.querySelectorAll(".mf-card").forEach(card=>{
      const input=card.querySelector("input[id^='mf-load-']");
      if(!input)return;
      const materialId=input.id.replace("mf-load-","");
      const loaded=loadMap.get(materialId);
      const usedText=card.querySelector(".mf-muted")?.textContent||"";
      const usedMatch=usedText.match(/Besoin retenu\s*:\s*([0-9.,]+)/i);
      const used=usedMatch?Number(usedMatch[1].replace(",",".")):0;
      const status=card.querySelector(".mf-stock-status")||document.createElement("div");
      status.className="mf-stock-status mf-muted";
      status.style.marginTop="6px";
      if(loaded==null){
        status.innerHTML=`<strong style="color:#b54708">Chargement non renseigné</strong><div>Le reste camion ne peut pas être calculé.</div>`;
      }else{
        const remaining=loaded-used;
        status.innerHTML=remaining<0?`<strong class="mf-bad">⚠️ Manque ${Math.abs(remaining).toFixed(2)} t</strong>`:`<strong class="mf-good">Reste estimé : ${remaining.toFixed(2)} t</strong>`;
      }
      const old=card.querySelector(".mf-good,.mf-bad");
      if(old && old!==status)old.replaceWith(status);else if(!status.parentElement)card.appendChild(status);
    });

    const costRows=[...panel.querySelectorAll(".mf-table tbody tr")].filter(tr=>tr.children.length>=6);
    costRows.forEach(tr=>{
      const price=tr.children[4]?.textContent||"";
      const cost=tr.children[5];
      if(price.includes("0.00 €/t")||price.includes("NaN")){
        if(cost)cost.innerHTML=`<span style="color:#b54708;font-weight:800">Prix d'achat manquant</span>`;
      }
    });
  }catch(e){console.warn("SETOM material quality fix",e)}
  finally{running=false}
}

const observer=new MutationObserver(()=>setTimeout(apply,120));
observer.observe(document.documentElement,{subtree:true,childList:true});
setInterval(apply,1500);
setTimeout(apply,1600);
