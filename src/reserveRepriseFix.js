import { supabase } from "./supabase";

function getOSNumber(){
  const m=(document.body?.innerText||"").match(/OS[- ]\d{4}[- ](\d{3,8})/i);
  return m ? Number(m[1]) : null;
}

async function getOS(){
  const n=getOSNumber();
  if(!Number.isFinite(n)) throw new Error("Impossible d'identifier l'OS affiché.");
  const {data,error}=await supabase.from("work_orders").select("id,os_number").eq("os_number",n).order("creation_date",{ascending:false}).limit(1).maybeSingle();
  if(error) throw error;
  if(!data) throw new Error("OS introuvable.");
  return data;
}

async function loadReserve(os){
  const {data:constat,error:e1}=await supabase.from("constats").select("*").eq("work_order_id",os.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(e1) throw e1;
  if(!constat || constat.status!=="Validé avec réserve" || constat.reserve_resolved_at) throw new Error("Action disponible uniquement pour une réserve non levée.");
  const {data:lines,error:e2}=await supabase.from("constat_lines").select("*").eq("constat_id",constat.id).order("id");
  if(e2) throw e2;
  return {constat,lines:lines||[]};
}

function modal(title,body){
  const wrap=document.createElement("div");
  wrap.style="position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:18px";
  wrap.innerHTML=`<div style="width:min(960px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:16px;padding:20px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><h3 style="margin-top:0">${title}</h3>${body}</div>`;
  document.body.appendChild(wrap);
  return wrap;
}

async function editConstat(){
  const os=await getOS();
  const {constat,lines}=await loadReserve(os);
  const box=modal("✏️ Modifier le constat",`<p>Réserve : ${String(constat.reserve_reason||"").replace(/</g,"&lt;")}</p><label>Observations</label><textarea id="sr-obs" rows="3" style="width:100%;box-sizing:border-box"></textarea><div id="sr-lines"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button id="sr-add">+ Ajouter une prestation</button><button id="sr-save">💾 Enregistrer et soumettre à nouveau</button><button id="sr-close">Annuler</button></div>`);
  box.querySelector("#sr-obs").value=constat.observations||"";
  const state=lines.map(x=>({...x}));
  const render=()=>{box.querySelector("#sr-lines").innerHTML=state.map((x,i)=>`<div data-i="${i}" style="border:1px solid #ddd;border-radius:8px;padding:8px;margin:8px 0"><input data-f="designation" value="${String(x.designation||"").replace(/"/g,"&quot;")}" placeholder="Prestation"><input data-f="quantity" type="number" step="0.01" value="${x.quantity??0}"><input data-f="unit" value="${String(x.unit||"").replace(/"/g,"&quot;")}" placeholder="Unité"><input data-f="unit_price" type="number" step="0.01" value="${x.unit_price??0}"><input data-f="observations" value="${String(x.observations||"").replace(/"/g,"&quot;")}" placeholder="Observation"><button data-remove="1">✕</button></div>`).join("");
    box.querySelectorAll("#sr-lines [data-i]").forEach(row=>row.querySelectorAll("input").forEach(inp=>inp.onchange=()=>{const i=Number(row.dataset.i);const f=inp.dataset.f;state[i][f]=(f==="quantity"||f==="unit_price")?Number(inp.value):inp.value;}));
    box.querySelectorAll("#sr-lines [data-remove]").forEach(btn=>btn.onclick=()=>{state.splice(Number(btn.parentElement.dataset.i),1);render();});
  };
  render();
  box.querySelector("#sr-add").onclick=()=>{state.push({bpu_line_id:"",designation:"Prestation",quantity:0,unit:"",unit_price:0,observations:""});render();};
  box.querySelector("#sr-close").onclick=()=>box.remove();
  box.querySelector("#sr-save").onclick=async()=>{
    const btn=box.querySelector("#sr-save");btn.disabled=true;
    try{
      const payload=state.map(x=>({bpu_line_id:x.bpu_line_id||"",designation:String(x.designation||"Prestation"),quantity:Number(x.quantity)||0,unit:String(x.unit||""),unit_price:Number(x.unit_price)||0,thickness_cm:x.thickness_cm??"",observations:x.observations||"",actual_quantity:x.actual_quantity??"",billing_coefficient:x.billing_coefficient??"",reference_thickness_cm:x.reference_thickness_cm??"",actual_thickness_cm:x.actual_thickness_cm??""}));
      const {error}=await supabase.rpc("update_constat_after_reserve",{p_work_order_id:os.id,p_constat_id:constat.id,p_observations:box.querySelector("#sr-obs").value||null,p_lines:payload});
      if(error)throw error;
      alert("✅ Constat modifié. Il repasse À vérifier pour une nouvelle validation.");location.reload();
    }catch(e){alert("Impossible de modifier le constat : "+(e?.message||e));btn.disabled=false;}
  };
}

async function addReservePhotos(){
  const os=await getOS();
  await loadReserve(os);
  const box=modal("📸 Photos de reprise",`<p>Ajoute les photos montrant la correction demandée.</p><input id="sr-files" type="file" accept="image/*" multiple><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button id="sr-upload">📤 Enregistrer les photos</button><button id="sr-close">Annuler</button></div>`);
  box.querySelector("#sr-close").onclick=()=>box.remove();
  box.querySelector("#sr-upload").onclick=async()=>{
    const files=Array.from(box.querySelector("#sr-files").files||[]);if(!files.length){alert("Ajoute au moins une photo.");return;}
    const btn=box.querySelector("#sr-upload");btn.disabled=true;
    try{
      const {data:userData}=await supabase.auth.getUser();if(!userData?.user)throw new Error("Utilisateur non authentifié.");
      for(let i=0;i<files.length;i++){
        const f=files[i];if(!String(f.type||"").startsWith("image/"))throw new Error("Seules les images sont acceptées.");
        const safe=f.name.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");
        const path=`work-orders/${os.id}/reserve-reprise/${Date.now()}-${i}-${safe}`;
        const {error:uerr}=await supabase.storage.from("setom-files").upload(path,f,{cacheControl:"3600",upsert:false,contentType:f.type});if(uerr)throw uerr;
        const {error:aerr}=await supabase.from("attachments").insert({work_order_id:os.id,category:"reserve_reprise",file_name:f.name,storage_path:path,mime_type:f.type,captured_at:new Date().toISOString(),created_by:userData.user.id});if(aerr)throw aerr;
      }
      alert("✅ Photos de reprise enregistrées.");box.remove();location.reload();
    }catch(e){alert("Impossible d'enregistrer les photos : "+(e?.message||e));btn.disabled=false;}
  };
}

function install(){
  const scan=()=>{
    if(!((document.body?.innerText||"").includes("Validé avec réserve")))return;
    const target=Array.from(document.querySelectorAll("div")).find(x=>x.textContent?.includes("Motif :")&&x.textContent?.includes("Réserve"));
    if(!target||target.querySelector("[data-setom-reserve-actions]"))return;
    const host=document.createElement("div");host.dataset.setomReserveActions="1";host.style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px";
    host.innerHTML='<button type="button">📸 Photos de reprise</button><button type="button">✏️ Modifier le constat</button>';
    host.children[0].onclick=()=>addReservePhotos().catch(e=>alert(e?.message||e));
    host.children[1].onclick=()=>editConstat().catch(e=>alert(e?.message||e));
    target.appendChild(host);
  };
  new MutationObserver(scan).observe(document.body,{subtree:true,childList:true});
  setTimeout(scan,500);setInterval(scan,1500);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
