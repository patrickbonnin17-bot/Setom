import { supabase } from "./supabase";

const ROOT_ID = "setom-chargement-page";
const STORAGE_KEY = "setom:chargement:v2";
const SECTION_KEY = "setom:current-section";

const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const esc = (v) => String(v ?? "").replace(/[&<>\"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c]));

function readStore() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (_) { return {}; } }
function writeDay(date, value) { try { const all = readStore(); all[date] = value; localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch (_) {} }
function readDay(date) {
  const all = readStore();
  return all[date] || { truck: "", team: "", rows: [{ id: String(Date.now()), material: "", planned: "", loaded: "", used: "" }] };
}

function getNav() { return document.querySelector("main.container .nav") || document.querySelector(".nav"); }
function getSectionButton() { return [...document.querySelectorAll("main.container .nav button, .nav button")].find(b => /chargement/i.test(b.textContent || "")); }
function isChargement() { return window.__setomCurrentSection === "chargement"; }

async function plannedForDate(date) {
  try {
    const { data: interventions, error } = await supabase.from("interventions").select("id, work_order_id, team_id, planned_date").eq("planned_date", date);
    if (error || !interventions?.length) return [];
    const ids = interventions.map(i => i.work_order_id).filter(Boolean);
    const { data: orders } = await supabase.from("work_orders").select("id, material_detail, planned_surface_m2").in("id", ids);
    const byId = new Map((orders || []).map(o => [o.id, o]));
    return interventions.map(i => ({ ...i, order: byId.get(i.work_order_id) || null })).filter(i => i.order);
  } catch (_) { return []; }
}

async function usedForDate(date) {
  try {
    const planned = await plannedForDate(date);
    const ids = planned.map(i => i.id).filter(Boolean);
    if (!ids.length) return {};
    const { data: realizations } = await supabase.from("work_realizations").select("intervention_id, quantity, surface_m2, thickness_cm, designation").in("intervention_id", ids);
    const result = {};
    for (const r of realizations || []) {
      const surface = num(r.surface_m2) || (String(r.unit || "").toLowerCase() === "m²" ? num(r.quantity) : 0);
      const thickness = num(r.thickness_cm);
      if (surface > 0 && thickness > 0) {
        if (!result[r.intervention_id]) result[r.intervention_id] = 0;
        result[r.intervention_id] += surface * thickness / 100;
      }
    }
    return result;
  } catch (_) { return {}; }
}

function injectStyles() {
  if (document.getElementById("setom-chargement-style")) return;
  const style = document.createElement("style"); style.id = "setom-chargement-style";
  style.textContent = `
    #${ROOT_ID}{padding-bottom:30px}.setom-load-shell{background:linear-gradient(135deg,#f7fafc,#eef4f7);border:1px solid #d8e2e8;border-radius:20px;padding:20px;box-shadow:0 10px 30px rgba(18,42,58,.08)}
    .setom-load-title{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:18px}.setom-load-kicker{font-size:11px;font-weight:800;letter-spacing:.12em;color:#627889}.setom-load-title h2{margin:3px 0 4px;color:#173d59}.setom-load-title p{margin:0;color:#687b89;font-size:13px}.setom-load-date{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.setom-load-date input{padding:10px;border:1px solid #cbd8e1;border-radius:9px;background:#fff}
    .setom-load-grid{display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:12px;margin-bottom:16px}.setom-load-card{background:#fff;border:1px solid #dbe4ea;border-radius:14px;padding:14px}.setom-load-card label{display:block;font-size:12px;font-weight:700;color:#607484;margin-bottom:5px}.setom-load-card input,.setom-load-card select{width:100%;box-sizing:border-box;min-height:40px;border:1px solid #cbd8e1;border-radius:9px;padding:9px;background:#fff;font:inherit}
    .setom-load-table{background:#fff;border:1px solid #dbe4ea;border-radius:14px;overflow:auto}.setom-load-table table{width:100%;min-width:920px;border-collapse:collapse}.setom-load-table th{text-align:left;background:#f5f8fa;color:#536979;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:10px;border-bottom:1px solid #dbe4ea}.setom-load-table td{padding:8px;border-bottom:1px solid #edf1f4;vertical-align:middle}.setom-load-table input,.setom-load-table select{width:100%;box-sizing:border-box;min-height:38px;border:1px solid #cbd8e1;border-radius:8px;padding:8px}.setom-load-table .readonly{background:#eef6f1;font-weight:800}.setom-load-remove{border:1px solid #d8e0e6;background:#fff;border-radius:8px;min-width:38px;height:38px;color:#a33;cursor:pointer}
    .setom-load-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-top:14px}.setom-load-metric{background:#fff;border:1px solid #dbe4ea;border-radius:12px;padding:11px}.setom-load-metric span{display:block;color:#718391;font-size:11px}.setom-load-metric strong{display:block;color:#173d59;font-size:19px;margin-top:3px}.setom-load-history{margin-top:18px}.setom-load-history h3{color:#173d59}.setom-load-history-item{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid #e3e9ed;font-size:13px}.setom-load-note{font-size:11px;color:#7b8b95;margin-top:10px}
    .setom-load-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}.setom-load-actions{display:flex;gap:8px;flex-wrap:wrap}.setom-load-actions button{border:0;border-radius:9px;padding:9px 12px;font-weight:700;cursor:pointer}.setom-load-primary{background:#173d59;color:#fff}.setom-load-secondary{background:#fff;color:#173d59;border:1px solid #cbd8e1!important}
    @media(max-width:760px){.setom-load-shell{padding:13px;border-radius:14px}.setom-load-title{display:block}.setom-load-date{margin-top:10px}.setom-load-grid{grid-template-columns:1fr}.setom-load-metrics{grid-template-columns:1fr 1fr}.setom-load-metric:last-child{grid-column:1/-1}}
  `; document.head.appendChild(style);
}

function restoreApp() {
  const root = document.getElementById(ROOT_ID); if (root) root.remove();
  const main = document.querySelector("main.container") || document.querySelector("main");
  if (!main) return;
  [...main.children].forEach(child => { if (!child.classList.contains("nav")) child.style.display = ""; });
  const nav = getNav(); if (nav) [...nav.querySelectorAll("button")].forEach(b => { if (b === getSectionButton()) b.classList.remove("active"); });
}

async function render() {
  const nav = getNav(); if (!nav) return;
  const button = getSectionButton(); if (!isChargement()) { if (button) button.classList.remove("active"); const existing=document.getElementById(ROOT_ID); if(existing)restoreApp(); return; }
  injectStyles();
  const main = document.querySelector("main.container") || document.querySelector("main");
  if (!main) return;
  [...main.children].forEach(child => { if (!child.classList.contains("nav")) child.style.display = "none"; });
  if (button) button.classList.add("active");
  let root = document.getElementById(ROOT_ID);
  if (!root) { root=document.createElement("section"); root.id=ROOT_ID; main.appendChild(root); }
  const date = root.dataset.date || today(); root.dataset.date=date;
  const day = readDay(date);
  const planned = await plannedForDate(date);
  const usedVolumes = await usedForDate(date);
  const plannedMaterials = new Map();
  for (const item of planned) {
    const material = item.order?.material_detail || "Matériau non renseigné";
    const entry = plannedMaterials.get(material) || { material, surface:0, usedM3:0 };
    entry.surface += num(item.order?.planned_surface_m2);
    entry.usedM3 += num(usedVolumes[item.id]);
    plannedMaterials.set(material, entry);
  }
  const rows = day.rows?.length ? day.rows : [{ id:String(Date.now()), material:"", planned:"", loaded:"", used:"" }];
  const plannedMap = new Map([...plannedMaterials.values()].map(x=>[x.material,x]));
  for (const r of rows) { if (r.material && !r.planned && plannedMap.has(r.material)) r.planned = ""; }
  const totalPlanned=rows.reduce((s,r)=>s+num(r.planned),0), totalLoaded=rows.reduce((s,r)=>s+num(r.loaded),0), totalUsed=rows.reduce((s,r)=>s+num(r.used),0), totalRemaining=totalLoaded-totalUsed, variance=totalLoaded-totalPlanned;
  const history = Object.entries(readStore()).filter(([d])=>d!==date).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,14);
  root.innerHTML=`<div class="setom-load-shell"><div class="setom-load-title"><div><div class="setom-load-kicker">LOGISTIQUE & MATÉRIAUX</div><h2>🚛 Chargement</h2><p>Préparer, enregistrer et contrôler le tonnage réel de la journée.</p></div><div class="setom-load-date"><label for="setom-load-date-input">Journée</label><input id="setom-load-date-input" type="date" value="${esc(date)}"></div></div>
    <div class="setom-load-grid"><div class="setom-load-card"><label>Camion</label><input id="setom-load-truck" value="${esc(day.truck)}" placeholder="Camion / immatriculation"></div><div class="setom-load-card"><label>Équipe</label><input id="setom-load-team" value="${esc(day.team)}" placeholder="Équipe affectée"></div></div>
    <div class="setom-load-toolbar"><strong>${planned.length} intervention(s) planifiée(s) ce jour</strong><div class="setom-load-actions"><button class="setom-load-secondary" id="setom-load-refresh">↻ Actualiser le planning</button><button class="setom-load-primary" id="setom-load-add">＋ Ajouter un matériau</button></div></div>
    <div class="setom-load-table"><table><thead><tr><th>Matériau</th><th>Prévu (t)</th><th>Chargé réel (t)</th><th>Utilisé (t)</th><th>Restant (t)</th><th>Écart (t)</th><th></th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-row="${i}"><td><input data-field="material" value="${esc(r.material)}" placeholder="Enrobé, grave…"></td><td><input data-field="planned" inputmode="decimal" value="${esc(r.planned)}" placeholder="0,00"></td><td><input data-field="loaded" inputmode="decimal" value="${esc(r.loaded)}" placeholder="0,00"></td><td><input data-field="used" inputmode="decimal" value="${esc(r.used)}" placeholder="0,00"></td><td class="readonly">${(num(r.loaded)-num(r.used)).toFixed(2)}</td><td class="readonly">${(num(r.loaded)-num(r.planned)).toFixed(2)}</td><td><button class="setom-load-remove" data-remove="${i}" type="button">×</button></td></tr>`).join("")}</tbody></table></div>
    <div class="setom-load-metrics"><div class="setom-load-metric"><span>Tonnage prévu</span><strong>${totalPlanned.toFixed(2)} t</strong></div><div class="setom-load-metric"><span>Chargé réel</span><strong>${totalLoaded.toFixed(2)} t</strong></div><div class="setom-load-metric"><span>Utilisé</span><strong>${totalUsed.toFixed(2)} t</strong></div><div class="setom-load-metric"><span>Restant</span><strong>${totalRemaining.toFixed(2)} t</strong></div><div class="setom-load-metric"><span>Écart chargé / prévu</span><strong>${variance.toFixed(2)} t</strong></div></div>
    <div class="setom-load-note">Les tonnages réellement chargés et les corrections saisies sont conservés par journée sur cet appareil. Le planning du jour est relu depuis Supabase à l’actualisation.</div>
    <div class="setom-load-history"><h3>Historique des chargements</h3>${history.length?history.map(([d,v])=>{const rr=v.rows||[];const p=rr.reduce((s,r)=>s+num(r.planned),0),l=rr.reduce((s,r)=>s+num(r.loaded),0),u=rr.reduce((s,r)=>s+num(r.used),0);return `<div class="setom-load-history-item"><span><strong>${new Date(d+"T12:00:00").toLocaleDateString("fr-FR")}</strong> · ${esc(v.team||"Équipe non renseignée")} · ${esc(v.truck||"Camion non renseigné")}</span><span>${l.toFixed(2)} t chargé · ${u.toFixed(2)} t utilisé · ${p.toFixed(2)} t prévu</span></div>`}).join(""):"<div class=\"setom-load-note\">Aucun historique enregistré sur cet appareil.</div>"}</div></div>`;
  const save = () => { const current=readDay(root.dataset.date||date); current.truck=root.querySelector("#setom-load-truck")?.value||""; current.team=root.querySelector("#setom-load-team")?.value||""; current.rows=[...root.querySelectorAll("tbody tr")].map((tr,i)=>{const old=rows[i]||{id:String(Date.now()+i)}; const out={...old}; tr.querySelectorAll("[data-field]").forEach(input=>out[input.dataset.field]=input.value); return out;}); writeDay(root.dataset.date||date,current); };
  root.querySelector("#setom-load-date-input")?.addEventListener("change",e=>{save();root.dataset.date=e.target.value||today();render();});
  root.querySelector("#setom-load-truck")?.addEventListener("input",save); root.querySelector("#setom-load-team")?.addEventListener("input",save);
  root.querySelectorAll("tbody [data-field]").forEach(input=>input.addEventListener("input",()=>{save();render();}));
  root.querySelectorAll("[data-remove]").forEach(btn=>btn.addEventListener("click",()=>{save();const current=readDay(root.dataset.date||date);current.rows.splice(Number(btn.dataset.remove),1);if(!current.rows.length)current.rows=[{id:String(Date.now()),material:"",planned:"",loaded:"",used:""}];writeDay(root.dataset.date||date,current);render();}));
  root.querySelector("#setom-load-add")?.addEventListener("click",()=>{save();const current=readDay(root.dataset.date||date);current.rows.push({id:String(Date.now()),material:"",planned:"",loaded:"",used:""});writeDay(root.dataset.date||date,current);render();});
  root.querySelector("#setom-load-refresh")?.addEventListener("click",()=>render());
}

function ensureButton() {
  const nav=getNav(); if(!nav)return;
  if(!getSectionButton()) {
    const button=document.createElement("button"); button.type="button"; button.textContent="🚛 Chargement"; button.dataset.setomChargement="1";
    button.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();window.__setomCurrentSection="chargement";sessionStorage.setItem(SECTION_KEY,"chargement");render();},true); nav.appendChild(button);
  }
}

document.addEventListener("click",e=>{
  const btn=e.target.closest("main.container .nav button, .nav button"); if(!btn)return;
  if(/chargement/i.test(btn.textContent||"")) return;
  window.__setomCurrentSection="other";sessionStorage.removeItem(SECTION_KEY);setTimeout(restoreApp,0);
},true);

const observer=new MutationObserver(()=>{ensureButton(); if(!isChargement())restoreApp();});
function boot(){ensureButton();injectStyles(); if(sessionStorage.getItem(SECTION_KEY)==="chargement"){window.__setomCurrentSection="chargement";render();}}
if(document.body) observer.observe(document.body,{childList:true,subtree:true});
setTimeout(boot,300);
