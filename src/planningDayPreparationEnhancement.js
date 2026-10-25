import { supabase } from "./supabase";

let installed = false;
let modal = null;
const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c]));
const dateFromPlanner = () => {
  const node = document.querySelector(".setom-plan-nav strong");
  const text = node?.textContent || "";
  const match = text.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i);
  if (!match) return new Date().toISOString().slice(0, 10);
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const month = months.indexOf(match[2].toLocaleLowerCase("fr-FR"));
  return `${match[3]}-${String(month + 1).padStart(2,"0")}-${String(match[1]).padStart(2,"0")}`;
};
const fmt = (n) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

async function loadPreparation(date) {
  const { data: interventions, error: intError } = await supabase
    .from("interventions")
    .select("id, work_order_id, team_id, planned_date, planned_order, status")
    .eq("planned_date", date)
    .order("planned_order", { ascending: true });
  if (intError) throw intError;
  const ids = (interventions || []).map((x) => x.work_order_id).filter(Boolean);
  if (!ids.length) return { date, teams: [], totalSurface: 0, orders: [], tasks: [] };

  const [{ data: orders, error: orderError }, { data: teams, error: teamError }, { data: tasks, error: taskError }] = await Promise.all([
    supabase.from("work_orders").select("id, os_number, creation_date, address, city, material_detail, planned_surface_m2, deadline_date, status, is_night").in("id", ids),
    supabase.from("teams").select("id, name, active, indicative_capacity").order("name"),
    supabase.from("planning_tasks").select("id, task_date, team_id, title, category, notes, planned_order").eq("task_date", date).order("planned_order", { ascending: true })
  ]);
  if (orderError) throw orderError;
  if (teamError) throw teamError;
  if (taskError) throw taskError;

  const byId = new Map((orders || []).map((o) => [o.id, o]));
  const teamById = new Map((teams || []).map((t) => [t.id, t]));
  const prepared = (interventions || []).map((i) => ({ ...i, order: byId.get(i.work_order_id), team: teamById.get(i.team_id) })).filter((i) => i.order);
  const teamGroups = new Map();
  prepared.forEach((item) => {
    const key = item.team_id || "none";
    if (!teamGroups.has(key)) teamGroups.set(key, { id: key, name: item.team?.name || "Équipe non affectée", orders: [], tasks: [] });
    teamGroups.get(key).orders.push(item);
  });
  (tasks || []).forEach((task) => {
    const key = task.team_id || "none";
    if (!teamGroups.has(key)) teamGroups.set(key, { id: key, name: teamById.get(task.team_id)?.name || "Toutes équipes", orders: [], tasks: [] });
    teamGroups.get(key).tasks.push(task);
  });
  return { date, teams: [...teamGroups.values()], totalSurface: prepared.reduce((sum, x) => sum + Number(x.order.planned_surface_m2 || 0), 0), orders: prepared, tasks: tasks || [] };
}

function close() { modal?.remove(); modal = null; }
function render(data) {
  const dateLabel = new Date(`${data.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const groups = data.teams.map((group) => `
    <section class="setom-dayprep-team">
      <header><div><strong>${esc(group.name)}</strong><span>${group.orders.length} OS · ${fmt(group.orders.reduce((s,x)=>s+Number(x.order.planned_surface_m2||0),0))} m²</span></div><span class="setom-dayprep-team-badge">${group.orders.length ? "PRÉPARÉ" : "TÂCHE"}</span></header>
      ${group.tasks.map((t) => `<div class="setom-dayprep-task"><b>⚠ ${esc(t.title)}</b><small>${esc(t.notes || "Tâche libre")}</small></div>`).join("")}
      ${group.orders.map((x, index) => `<article class="setom-dayprep-os"><div class="setom-dayprep-order">${index + 1}</div><div class="setom-dayprep-os-main"><div><strong>OS-${esc(String(x.order.os_number).padStart(5,"0"))}</strong><span>${esc(x.order.status || "")}</span></div><b>${esc(x.order.address || "Adresse non renseignée")}${x.order.city ? ` · ${esc(x.order.city)}` : ""}</b><small>${esc(x.order.material_detail || "Matériau non renseigné")} · ${fmt(x.order.planned_surface_m2)} m²${x.order.is_night ? " · 🌙 Nuit" : ""}</small></div><div class="setom-dayprep-deadline">Échéance<br><b>${x.order.deadline_date ? new Date(`${x.order.deadline_date}T12:00:00`).toLocaleDateString("fr-FR") : "—"}</b></div></article>`).join("") || `<div class="setom-dayprep-empty">Aucun OS affecté.</div>`}
    </section>`).join("");
  modal.innerHTML = `<div class="setom-dayprep-dialog"><header class="setom-dayprep-head"><div><span class="setom-dayprep-kicker">PRÉPARATION OPÉRATIONNELLE</span><h2>Préparer ma journée</h2><p>${dateLabel}</p></div><button type="button" data-close>✕</button></header><div class="setom-dayprep-summary"><div><span>OS</span><strong>${data.orders.length}</strong></div><div><span>Surface</span><strong>${fmt(data.totalSurface)} m²</strong></div><div><span>Matériau</span><strong>${new Set(data.orders.map(x => x.order.material_detail).filter(Boolean)).size <= 1 ? esc(data.orders[0]?.order.material_detail || "—") : "⚠ Plusieurs matériaux"}</strong></div><div><span>Tonnage</span><strong>À calculer</strong><small>densité/BPU à connecter</small></div></div><div class="setom-dayprep-warning">✓ Les données viennent directement du planning et des OS. Aucune ressaisie de surface ou de matériau.</div><div class="setom-dayprep-body">${groups || `<div class="setom-dayprep-empty">Aucune intervention planifiée pour cette journée.</div>`}</div><footer class="setom-dayprep-foot"><button type="button" data-map>Voir l’itinéraire</button><span>Camion : <b>À affecter</b> · Marge : <b>selon préparation</b></span><button type="button" class="primary" data-close>Valider la préparation</button></footer></div>`;
  modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  modal.querySelector("[data-map]")?.addEventListener("click", () => { close(); document.querySelector(".setom-plan-tabs button:nth-child(4)")?.click(); });
}
async function open() {
  if (modal) return;
  modal = document.createElement("div");
  modal.className = "setom-dayprep-backdrop";
  modal.innerHTML = `<div class="setom-dayprep-dialog"><div class="setom-dayprep-loading">Préparation de la journée…</div></div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  try { render(await loadPreparation(dateFromPlanner())); } catch (error) { modal.innerHTML = `<div class="setom-dayprep-dialog"><div class="setom-dayprep-error"><h2>Préparation impossible</h2><p>${esc(error?.message || "Impossible de charger les données de la journée.")}</p><button type="button" data-close>Fermer</button></div></div>`; modal.querySelector("[data-close]")?.addEventListener("click", close); }
}
function installStyles() {
  if (document.getElementById("setom-dayprep-styles")) return;
  const style = document.createElement("style"); style.id = "setom-dayprep-styles"; style.textContent = `.setom-dayprep-backdrop{position:fixed;inset:0;background:rgba(8,27,53,.62);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:24px}.setom-dayprep-dialog{width:min(1100px,100%);max-height:92vh;overflow:auto;background:#f5f8fc;border-radius:20px;box-shadow:0 28px 90px rgba(0,0,0,.28);color:#102a43}.setom-dayprep-head{background:#083b73;color:white;padding:22px 26px;display:flex;justify-content:space-between}.setom-dayprep-head h2{margin:5px 0 2px;font-size:26px}.setom-dayprep-head p{margin:0;color:#cfe2f5}.setom-dayprep-head button{border:0;background:rgba(255,255,255,.12);color:white;border-radius:9px;width:36px;height:36px}.setom-dayprep-kicker{font-size:10px;letter-spacing:1.5px;color:#ffd400;font-weight:800}.setom-dayprep-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px 22px}.setom-dayprep-summary>div{background:white;border-radius:12px;padding:13px 15px;border:1px solid #dce6f1}.setom-dayprep-summary span,.setom-dayprep-summary small{display:block;font-size:11px;color:#64748b}.setom-dayprep-summary strong{display:block;margin-top:4px;font-size:18px}.setom-dayprep-warning{margin:0 22px 12px;padding:11px 14px;background:#e9f7ef;border:1px solid #b7e4c7;border-radius:10px;font-size:12px;color:#17643a}.setom-dayprep-body{padding:0 22px 18px;display:flex;flex-direction:column;gap:12px}.setom-dayprep-team{background:white;border:1px solid #dce6f1;border-radius:14px;overflow:hidden}.setom-dayprep-team>header{padding:12px 15px;background:#edf4fb;display:flex;justify-content:space-between}.setom-dayprep-team>header span{display:block;color:#64748b;font-size:11px;margin-top:3px}.setom-dayprep-team-badge{font-weight:800!important;color:#1769aa!important}.setom-dayprep-os{display:grid;grid-template-columns:38px 1fr 110px;gap:12px;align-items:center;padding:11px 15px;border-top:1px solid #edf1f5}.setom-dayprep-order{width:30px;height:30px;border-radius:50%;background:#175cd3;color:white;display:grid;place-items:center;font-weight:800}.setom-dayprep-os-main>div{display:flex;gap:8px;align-items:center}.setom-dayprep-os-main>div span{font-size:10px;background:#e7eef8;padding:3px 7px;border-radius:999px}.setom-dayprep-os-main>b,.setom-dayprep-os-main>small{display:block;margin-top:3px}.setom-dayprep-os-main small{color:#64748b}.setom-dayprep-deadline{text-align:right;font-size:10px;color:#64748b}.setom-dayprep-deadline b{color:#102a43;font-size:12px}.setom-dayprep-task{margin:9px 15px 0;padding:8px 10px;border-left:3px solid #f59e0b;background:#fff8e7}.setom-dayprep-task small{display:block;color:#64748b}.setom-dayprep-empty,.setom-dayprep-loading,.setom-dayprep-error{padding:40px;text-align:center}.setom-dayprep-foot{position:sticky;bottom:0;background:white;border-top:1px solid #dce6f1;padding:13px 22px;display:flex;align-items:center;gap:12px}.setom-dayprep-foot span{flex:1;color:#64748b;font-size:12px}.setom-dayprep-foot button{border:1px solid #cbd5e1;background:white;border-radius:9px;padding:10px 14px}.setom-dayprep-foot .primary{background:#175cd3;color:white;border-color:#175cd3}@media(max-width:700px){.setom-dayprep-summary{grid-template-columns:1fr 1fr}.setom-dayprep-os{grid-template-columns:32px 1fr}.setom-dayprep-deadline{display:none}.setom-dayprep-foot{flex-wrap:wrap}.setom-dayprep-foot span{order:3;width:100%;flex-basis:100%}}`; document.head.appendChild(style);
}
function addButton() {
  const nav = document.querySelector(".setom-plan-nav");
  if (!nav || nav.querySelector("[data-prepare-day]")) return;
  const button = document.createElement("button"); button.type = "button"; button.dataset.prepareDay = "true"; button.textContent = "🧰 Préparer ma journée"; button.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); open(); }); nav.appendChild(button);
}
function install() { if (installed) return; installed = true; installStyles(); const observer = new MutationObserver(() => { if (document.querySelector("#setom-planner-host")) addButton(); }); observer.observe(document.body,{childList:true,subtree:true}); }
install();
