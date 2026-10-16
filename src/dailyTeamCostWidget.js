import { supabase } from "./supabase";

const ID = "setom-daily-team-costs";
const CATS = [
  ["personnel", "👷 Personnel"],
  ["vehicules", "🚛 Véhicules"],
  ["materiaux", "🧱 Matériaux"],
  ["materiel", "🔧 Matériel"],
  ["carburant", "⛽ Carburant"],
  ["autres", "📦 Autres frais"]
];
const n = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const money = (v) => `${n(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const iso = (v) => String(v || "").slice(0, 10);

function selectedDate() {
  const el = document.querySelector("input[type=date][data-setom-selected-date], .planning-date-input");
  return iso(el?.value) || new Date().toISOString().slice(0, 10);
}

async function load(date) {
  const { data, error } = await supabase.from("interventions")
    .select("id,work_order_id,planned_order,arrival_time,departure_time,team_id")
    .eq("planned_date", date).order("planned_order", { ascending: true });
  if (error) throw error;
  const rows = data || [];
  const ids = [...new Set(rows.map(x => x.work_order_id).filter(Boolean))];
  let orders = [];
  if (ids.length) {
    const r = await supabase.from("work_orders").select("id,os_number,address,city").in("id", ids);
    if (r.error) throw r.error;
    orders = r.data || [];
  }
  const om = new Map(orders.map(x => [x.id, x]));
  const interventions = rows.map((x, i) => {
    const o = om.get(x.work_order_id) || {};
    const start = x.arrival_time ? new Date(`${date}T${String(x.arrival_time).slice(0,8)}`) : null;
    const end = x.departure_time ? new Date(`${date}T${String(x.departure_time).slice(0,8)}`) : null;
    let hours = start && end && end > start ? (end - start) / 3600000 : 0;
    if (hours > 24) hours = 0;
    return { ...x, ...o, hours, order: n(x.planned_order) || i + 1 };
  });
  return interventions;
}

function style() {
  if (document.getElementById(`${ID}-style`)) return;
  const s = document.createElement("style"); s.id = `${ID}-style`; s.textContent = `
#${ID}{margin:12px 0;padding:15px;border:1px solid #dce5f1;border-radius:16px;background:#fff;box-shadow:0 7px 22px rgba(16,42,86,.06);font-family:inherit}
#${ID} .dt-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.dt-title{font-size:17px;font-weight:850;color:#102a56}.dt-sub{font-size:12px;color:#667085;margin-top:3px}
#${ID} .dt-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:12px}.dt-field{padding:9px;border:1px solid #e4eaf2;border-radius:11px;background:#f9fbfe}.dt-field label{display:block;font-size:11px;color:#667085;margin-bottom:5px}.dt-field input{width:100%;box-sizing:border-box;border:1px solid #d6deea;border-radius:8px;padding:8px;font-weight:750;font-size:14px}
#${ID} .dt-total{margin-top:11px;padding:11px;border-radius:12px;background:#102a56;color:#fff;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.dt-total strong{font-size:18px}
#${ID} table{width:100%;border-collapse:collapse;margin-top:12px}#${ID} th,#${ID} td{padding:7px;border-bottom:1px solid #edf1f6;font-size:12px;text-align:left}#${ID} th{color:#667085}.dt-hours{width:90px!important}.dt-right{text-align:right!important}.dt-save{border:0;border-radius:9px;padding:9px 13px;background:#0759d6;color:#fff;font-weight:750;cursor:pointer}.dt-msg{font-size:12px;margin-top:8px;color:#087443}.dt-warn{color:#b54708}
@media(max-width:800px){#${ID} .dt-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:550px){#${ID} .dt-grid{grid-template-columns:1fr}}
`; document.head.appendChild(s);
}

function remove() { document.getElementById(ID)?.remove(); }

async function render(date = selectedDate()) {
  style();
  const host = document.querySelector(".planning-overlay, .planner-overlay, [data-setom-planning], .planning-container");
  if (!host) return;
  remove();
  const box = document.createElement("section"); box.id = ID; host.prepend(box);
  box.innerHTML = `<div class="dt-head"><div><div class="dt-title">💶 Coût équipe — journée</div><div class="dt-sub">Saisie du coût global depuis le logiciel interne puis répartition par heures sur les OS.</div></div><button class="dt-save" data-action="refresh">Actualiser</button></div><div class="dt-sub" style="margin-top:10px">Chargement…</div>`;
  try {
    const interventions = await load(date);
    if (!interventions.length) { box.querySelector(".dt-sub:last-child").textContent = "Aucune intervention planifiée pour cette journée."; return; }
    box.innerHTML = `<div class="dt-head"><div><div class="dt-title">💶 Coût équipe — journée</div><div class="dt-sub">Les montants sont saisis une seule fois par jour. SETOM calcule le coût horaire puis l'affecte aux OS selon les heures.</div></div><button class="dt-save" data-action="refresh">Actualiser</button></div>
      <div class="dt-grid">${CATS.map(([key,label]) => `<div class="dt-field"><label>${label} (€)</label><input inputmode="decimal" type="number" min="0" step="0.01" data-cat="${key}" value="0" /></div>`).join("")}</div>
      <div class="dt-total"><span>Coût global journée</span><strong data-total>0,00 €</strong><span>Coût horaire</span><strong data-rate>0,00 €/h</strong></div>
      <div class="dt-sub" style="margin-top:10px">Heures par OS : préremplies depuis arrivée/départ. Tu peux les corriger si nécessaire.</div>
      <table><thead><tr><th>#</th><th>OS</th><th>Adresse</th><th>Heures</th></tr></thead><tbody>${interventions.map((r,i)=>`<tr><td>${r.order}</td><td><strong>OS-${String(r.os_number ?? "").padStart(5,"0")}</strong></td><td>${r.address||""}${r.city?` · ${r.city}`:""}</td><td><input class="dt-hours" data-hours="${r.work_order_id}" type="number" min="0" step="0.25" value="${r.hours.toFixed(2)}" /></td></tr>`).join("")}</tbody></table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="dt-save" data-action="save">Enregistrer et répartir les coûts</button></div><div class="dt-sub" data-msg></div>`;

    const updateTotals = () => {
      const total = CATS.reduce((s,[key])=>s+n(box.querySelector(`[data-cat="${key}"]`)?.value),0);
      const hours = [...box.querySelectorAll("[data-hours]")].reduce((s,e)=>s+n(e.value),0);
      box.querySelector("[data-total]").textContent = money(total);
      box.querySelector("[data-rate]").textContent = hours > 0 ? `${money(total/hours)}/h` : "0,00 €/h";
      return { total, hours };
    };
    box.querySelectorAll("input").forEach(e=>e.addEventListener("input",updateTotals));
    updateTotals();

    box.querySelector('[data-action="refresh"]').onclick = () => render(date);
    box.querySelector('[data-action="save"]').onclick = async () => {
      const msg = box.querySelector("[data-msg]"); msg.className = "dt-sub"; msg.textContent = "Enregistrement…";
      try {
        const { total, hours } = updateTotals();
        if (total <= 0) throw new Error("Saisis au moins un coût journalier.");
        if (hours <= 0) throw new Error("Il faut au moins une heure affectée à un OS.");
        const allocations = [];
        for (const r of interventions) {
          const h = n(box.querySelector(`[data-hours="${r.work_order_id}"]`)?.value);
          if (!h || !r.work_order_id) continue;
          const ratio = h / hours;
          for (const [key,label] of CATS) {
            const amount = n(box.querySelector(`[data-cat="${key}"]`)?.value);
            if (amount <= 0) continue;
            allocations.push({ work_order_id:r.work_order_id, intervention_id:r.id, cost_date:date, category:"autre", description:`Équipe ${label.replace(/^\S+\s/,"").replace(" (€)","")} — ${h.toFixed(2)} h`, amount:Number((amount*ratio).toFixed(2)), quantity:h, unit:"h" });
          }
        }
        if (!allocations.length) throw new Error("Aucune répartition à enregistrer.");
        const workOrderIds = [...new Set(interventions.map(x=>x.work_order_id).filter(Boolean))];
        const del = await supabase.from("work_order_costs").delete().eq("cost_date", date).in("work_order_id", workOrderIds).like("description", "Équipe %");
        if (del.error) throw del.error;
        const ins = await supabase.from("work_order_costs").insert(allocations);
        if (ins.error) throw ins.error;
        msg.className = "dt-msg"; msg.textContent = `✓ ${money(total)} répartis sur ${hours.toFixed(2)} h (${money(total/hours)}/h). Le Pilotage journée les prendra en compte.`;
      } catch (e) { msg.className = "dt-sub dt-warn"; msg.textContent = `⚠ ${e.message || "Erreur d'enregistrement"}`; }
    };
  } catch (e) {
    box.innerHTML = `<div class="dt-title">💶 Coût équipe — journée</div><div class="dt-sub dt-warn" style="margin-top:8px">Impossible de charger les interventions : ${e.message || e}</div>`;
  }
}

let timer;
function schedule() { clearTimeout(timer); timer = setTimeout(()=>render(), 180); }
new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true });
window.addEventListener("setom:planning-refresh", schedule);
setTimeout(schedule, 900);
