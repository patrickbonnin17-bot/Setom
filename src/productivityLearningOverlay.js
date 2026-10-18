const ROOT_ID = "setom-productivity-learning";
const KEY = "setom:productivity-observations:v1";

const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const today = () => new Date().toISOString().slice(0, 10);
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) {} };
const esc = (v) => String(v ?? "").replace(/[&<>\"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function styles(){
  if(document.getElementById(`${ROOT_ID}-style`)) return;
  const s=document.createElement("style"); s.id=`${ROOT_ID}-style`; s.textContent=`
  #${ROOT_ID}{margin:16px 0;padding:16px;border:1px solid #d7e3eb;border-radius:14px;background:linear-gradient(180deg,#fbfdfe,#f6fafc);font-family:Inter,system-ui,sans-serif;color:#17334d}
  #${ROOT_ID} .pl-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.pl-head h3{margin:3px 0;font-size:15px}.pl-head p{margin:0;color:#718391;font-size:11px;line-height:1.45}.pl-badge{font-size:9px;font-weight:800;padding:5px 8px;border-radius:999px;background:#eaf7ef;color:#18733c;white-space:nowrap}
  #${ROOT_ID} .pl-grid{display:grid;grid-template-columns:repeat(6,minmax(100px,1fr));gap:8px;margin-top:12px}.pl-field label{display:block;font-size:9px;font-weight:800;color:#718391;margin-bottom:4px}.pl-field input,.pl-field select{width:100%;box-sizing:border-box;border:1px solid #cddce5;border-radius:8px;background:#fff;padding:8px;font-size:11px;color:#17334d}.pl-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.pl-actions button{border:1px solid #b9ccd7;background:#fff;border-radius:8px;padding:8px 11px;font-weight:800;color:#17334d;cursor:pointer}.pl-actions .primary{background:#0f8f4b;color:#fff;border-color:#0f8f4b}.pl-foot{margin-top:8px;font-size:9px;color:#81919c}.pl-insight{margin-top:10px;padding:9px;border-radius:9px;background:#fff;border:1px solid #e0e9ee;font-size:10px}.pl-insight strong{color:#0f7540}.pl-list{margin-top:8px;display:grid;gap:5px}.pl-row{display:flex;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:7px;background:#fff;border:1px solid #e7edf1;font-size:9px}.pl-row span:last-child{color:#6d7e89}@media(max-width:900px){#${ROOT_ID} .pl-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:600px){#${ROOT_ID} .pl-head{flex-direction:column}#${ROOT_ID} .pl-grid{grid-template-columns:repeat(2,1fr)}}`;
  document.head.appendChild(s);
}

function currentOrder(){
  try { return JSON.parse(localStorage.getItem("setom:chargement:order:v1") || localStorage.getItem("setom:planning:selected-order:v1") || "null") || {}; } catch (_) { return {}; }
}
function estimate(){
  const all=read(); if(!all.length) return null;
  const recent=all.slice(-30); const grouped={};
  recent.forEach(o=>{ const key=o.workType||"autre"; if(!grouped[key]) grouped[key]=[]; grouped[key].push(o); });
  const result={};
  Object.entries(grouped).forEach(([type,items])=>{
    const valid=items.filter(x=>num(x.quantity)>0&&num(x.durationHours)>0&&num(x.people)>0);
    if(!valid.length) return;
    const rates=valid.map(x=>num(x.quantity)/(num(x.durationHours)*num(x.people))).filter(x=>x>0);
    result[type]={count:valid.length,rate:rates.reduce((a,b)=>a+b,0)/rates.length};
  });
  return result;
}
function render(){
  const host=document.querySelector('[data-setom-travaux-photo-zone="true"]')?.parentElement || document.querySelector(".work-page,.travaux-page");
  if(!host) return;
  styles();
  let root=document.getElementById(ROOT_ID); if(!root){root=document.createElement("section");root.id=ROOT_ID;host.appendChild(root);}
  const order=currentOrder(); const estimates=estimate();
  const existing=read().filter(x=>x.date===today()).slice(-3).reverse();
  root.innerHTML=`<div class="pl-head"><div><span class="pl-badge">APPRENTISSAGE SETOM</span><h3>⏱️ Temps réel & effectif de l’intervention</h3><p>Ces données ne modifient pas encore automatiquement le planning. Elles servent à apprendre les rendements réels de SETOM et préparer les futures recommandations IA.</p></div><div style="font-size:10px;color:#718391">${esc(order.osNumber||order.osId||"")}</div></div>
  <div class="pl-grid">
    <div class="pl-field"><label>TYPE DE TRAVAUX</label><select id="pl-type"><option>Enrobé</option><option>Béton</option><option>Terrassement</option><option>Autre</option></select></div>
    <div class="pl-field"><label>QUANTITÉ RÉALISÉE</label><input id="pl-qty" type="number" min="0" step="0.01" placeholder="ex. 420" /></div>
    <div class="pl-field"><label>UNITÉ</label><select id="pl-unit"><option>m²</option><option>t</option><option>m³</option><option>ml</option></select></div>
    <div class="pl-field"><label>ÉPAISSEUR (cm)</label><input id="pl-thickness" type="number" min="0" step="0.1" placeholder="ex. 6" /></div>
    <div class="pl-field"><label>EFFECTIF PRÉSENT</label><input id="pl-people" type="number" min="1" step="1" value="5" /></div>
    <div class="pl-field"><label>DURÉE (heures)</label><input id="pl-duration" type="number" min="0" step="0.25" placeholder="ex. 7.5" /></div>
    <div class="pl-field"><label>CIRCULATION</label><select id="pl-traffic"><option>Faible</option><option>Moyenne</option><option>Forte</option><option>Très forte</option></select></div>
    <div class="pl-field"><label>ACCÈS / CONTRAINTE</label><select id="pl-access"><option>Normal</option><option>Accès difficile</option><option>Circulation chantier</option><option>Accès très contraint</option></select></div>
  </div>
  <div class="pl-actions"><button class="primary" id="pl-save">Enregistrer l’observation</button><button id="pl-clear">Effacer les valeurs</button></div>
  <div class="pl-foot">Règle métier actuelle : <strong>enrobé ≥ 5 personnes</strong>. Le minimum sera configurable pour chaque type de travaux.</div>
  ${estimates ? `<div class="pl-insight"><strong>Premières références apprises :</strong> ${Object.entries(estimates).map(([k,v])=>`${esc(k)} : ${v.rate.toFixed(2)} unité/h/personne (${v.count} observation${v.count>1?"s":""})`).join(" · ")}</div>` : ""}
  ${existing.length ? `<div class="pl-list">${existing.map(o=>`<div class="pl-row"><span>${esc(o.workType)} · ${num(o.quantity).toFixed(1)} ${esc(o.unit)} · ${num(o.people)} pers.</span><span>${num(o.durationHours).toFixed(2)} h · ${esc(o.traffic)}</span></div>`).join("")}</div>` : ""}`;
  root.querySelector("#pl-save")?.addEventListener("click",()=>{
    const type=root.querySelector("#pl-type").value; const people=Math.max(1,num(root.querySelector("#pl-people").value));
    if(type==="Enrobé"&&people<5){ alert("SETOM : l'enrobé nécessite au minimum 5 personnes selon la règle métier actuelle."); return; }
    const observation={id:`obs-${Date.now()}`,date:today(),osId:order.orderId||order.id||null,osNumber:order.osNumber||null,workType:type,quantity:num(root.querySelector("#pl-qty").value),unit:root.querySelector("#pl-unit").value,thicknessCm:num(root.querySelector("#pl-thickness").value),people,durationHours:num(root.querySelector("#pl-duration").value),traffic:root.querySelector("#pl-traffic").value,access:root.querySelector("#pl-access").value,createdAt:new Date().toISOString()};
    const next=read(); next.push(observation); write(next.slice(-1000)); window.dispatchEvent(new CustomEvent("setom:productivity-observation",{detail:observation})); render();
  });
  root.querySelector("#pl-clear")?.addEventListener("click",()=>{root.querySelectorAll("input").forEach(i=>{if(i.id!=="pl-people")i.value="";});});
}
let timer; const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,150);};
window.addEventListener("setom:navigate",schedule); window.addEventListener("setom:travaux-updated",schedule); window.addEventListener("setom:planning-order-changed",schedule); window.addEventListener("setom:chargement-order-changed",schedule); window.addEventListener("DOMContentLoaded",schedule); window.addEventListener("storage",schedule);
setInterval(()=>{ if(document.visibilityState!=="hidden") render(); },1800);
