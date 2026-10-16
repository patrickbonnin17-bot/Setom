import { supabase } from "./supabase";

const ROOT_ID = "setom-planning-tasks-widget";
const TASK_CATEGORIES = [
  ["preparation", "Préparation de chantier"],
  ["signalisation", "Signalisation"],
  ["chargement", "Chargement camion"],
  ["nettoyage", "Nettoyage"],
  ["entretien", "Entretien matériel"],
  ["approvisionnement", "Approvisionnement matériaux"],
  ["deplacement", "Déplacement"],
  ["administratif", "Administratif"],
  ["autre", "Autre"]
];

let initialized = false;

function esc(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
}

function planningRoot() {
  return document.querySelector(".setom-map-canvas")?.closest("section,main,div") || document.body;
}

function selectedPlanningDate() {
  const dateInput = document.querySelector(".setom-map-order input[type='date']");
  return dateInput?.value || new Date().toISOString().slice(0, 10);
}

async function loadTasks(date) {
  const { data, error } = await supabase
    .from("planning_tasks")
    .select("id, task_date, team_id, title, category, notes, planned_order")
    .eq("task_date", date)
    .order("planned_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function loadTeams() {
  const { data, error } = await supabase.from("teams").select("id,name,active").order("name", { ascending: true });
  if (error) throw error;
  return (data || []).filter((team) => team.active !== false);
}

function taskForm(date, teams) {
  const categories = TASK_CATEGORIES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  const teamOptions = `<option value="">Toutes / non affectée</option>` + teams.map((team) => `<option value="${esc(team.id)}">${esc(team.name)}</option>`).join("");
  return `<form id="setom-planning-task-form" class="setom-task-form">
    <div class="setom-task-form-grid">
      <label>Date<input id="setom-task-date" type="date" value="${esc(date)}" required></label>
      <label>Équipe<select id="setom-task-team">${teamOptions}</select></label>
      <label>Type<select id="setom-task-category">${categories}</select></label>
      <label class="setom-task-title-field">Tâche<input id="setom-task-title" type="text" maxlength="120" placeholder="Ex. Charger le camion" required></label>
      <label class="setom-task-notes-field">Notes<textarea id="setom-task-notes" rows="2" maxlength="500" placeholder="Précisions facultatives"></textarea></label>
    </div>
    <div class="setom-task-form-actions"><button type="submit" class="setom-task-primary">＋ Ajouter la tâche</button><span id="setom-task-error" role="alert"></span></div>
  </form>`;
}

function styles() {
  if (document.getElementById("setom-planning-tasks-style")) return;
  const style = document.createElement("style");
  style.id = "setom-planning-tasks-style";
  style.textContent = `
    #${ROOT_ID}{margin:14px 0;padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;box-shadow:0 4px 18px rgba(15,23,42,.06);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    #${ROOT_ID} .setom-task-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    #${ROOT_ID} h3{margin:0;font-size:17px;color:#17202a}
    #${ROOT_ID} .setom-task-sub{font-size:12px;color:#667085;margin-top:3px}
    #${ROOT_ID} .setom-task-form{padding:12px;border-radius:12px;background:#f7f8fa;border:1px solid #edf0f4}
    #${ROOT_ID} .setom-task-form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    #${ROOT_ID} label{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:700;color:#475467}
    #${ROOT_ID} input,#${ROOT_ID} select,#${ROOT_ID} textarea{box-sizing:border-box;width:100%;font:inherit;font-weight:500;font-size:13px;padding:9px 10px;border:1px solid #d0d5dd;border-radius:9px;background:#fff;color:#17202a}
    #${ROOT_ID} textarea{resize:vertical}.setom-task-title-field{grid-column:span 2}.setom-task-notes-field{grid-column:span 2}
    #${ROOT_ID} .setom-task-form-actions{display:flex;align-items:center;gap:10px;margin-top:10px}.setom-task-primary{border:0;border-radius:9px;padding:9px 13px;background:#2563eb;color:#fff;font-weight:800;cursor:pointer}.setom-task-primary:disabled{opacity:.55;cursor:wait}
    #${ROOT_ID} #setom-task-error{font-size:12px;color:#b42318}
    #${ROOT_ID} .setom-task-list{display:grid;gap:8px;margin-top:12px}.setom-task-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #edf0f4;border-radius:11px;background:#fff}.setom-task-icon{width:32px;height:32px;border-radius:9px;background:#eef4ff;display:grid;place-items:center;flex:0 0 auto}.setom-task-main{min-width:0;flex:1}.setom-task-main strong{display:block;font-size:13px;color:#17202a}.setom-task-main span{display:block;margin-top:2px;font-size:11px;color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.setom-task-delete{border:0;background:transparent;color:#98a2b3;cursor:pointer;font-size:18px;padding:7px}.setom-task-empty{padding:12px;text-align:center;color:#98a2b3;font-size:12px}
    @media(max-width:800px){#${ROOT_ID} .setom-task-form-grid{grid-template-columns:1fr 1fr}.setom-task-title-field,.setom-task-notes-field{grid-column:span 2}}
    @media(max-width:520px){#${ROOT_ID} .setom-task-form-grid{grid-template-columns:1fr}.setom-task-title-field,.setom-task-notes-field{grid-column:span 1}.setom-task-row{align-items:flex-start}}
  `;
  document.head.appendChild(style);
}

async function render() {
  if (!document.body.contains(document.getElementById(ROOT_ID))) return;
  const root = document.getElementById(ROOT_ID);
  const date = selectedPlanningDate();
  try {
    const [teams, tasks] = await Promise.all([loadTeams(), loadTasks(date)]);
    root.innerHTML = `<div class="setom-task-head"><div><h3>🛠️ Tâches du planning</h3><div class="setom-task-sub">Les tâches complètent les OS sans devenir des ordres de service.</div></div></div>${taskForm(date, teams)}<div class="setom-task-list">${tasks.length ? tasks.map((task) => { const team=teams.find((item)=>item.id===task.team_id); const cat=TASK_CATEGORIES.find(([value])=>value===task.category)?.[1]||"Autre"; return `<div class="setom-task-row"><div class="setom-task-icon">🛠️</div><div class="setom-task-main"><strong>${esc(task.title)}</strong><span>${esc(cat)}${team ? " · " + esc(team.name) : ""}${task.notes ? " · " + esc(task.notes) : ""}</span></div><button type="button" class="setom-task-delete" data-task-id="${esc(task.id)}" aria-label="Supprimer la tâche">×</button></div>`; }).join("") : `<div class="setom-task-empty">Aucune tâche libre pour cette journée.</div>`}</div>`;
    root.querySelector("#setom-planning-task-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = root.querySelector(".setom-task-primary");
      const errorNode = root.querySelector("#setom-task-error");
      const payload = { task_date: root.querySelector("#setom-task-date")?.value, team_id: root.querySelector("#setom-task-team")?.value || null, category: root.querySelector("#setom-task-category")?.value || "autre", title: root.querySelector("#setom-task-title")?.value.trim(), notes: root.querySelector("#setom-task-notes")?.value.trim() || null, planned_order: tasks.length + 1 };
      if (!payload.title || !payload.task_date) { errorNode.textContent = "Indiquez au minimum la date et la tâche."; return; }
      button.disabled = true; errorNode.textContent = "";
      const { error } = await supabase.from("planning_tasks").insert(payload);
      if (error) { errorNode.textContent = error.message || "Impossible d'ajouter la tâche."; button.disabled = false; return; }
      window.dispatchEvent(new Event("setom:planning-updated"));
      render();
    });
    root.querySelectorAll(".setom-task-delete").forEach((button) => button.addEventListener("click", async () => {
      if (!window.confirm("Supprimer cette tâche du planning ?")) return;
      const { error } = await supabase.from("planning_tasks").delete().eq("id", button.dataset.taskId);
      if (error) { alert("Impossible de supprimer la tâche :\n\n" + error.message); return; }
      render();
    }));
  } catch (error) {
    root.innerHTML = `<div class="setom-task-empty">Impossible de charger les tâches du planning : ${esc(error?.message || "erreur inconnue")}</div>`;
  }
}

function install() {
  if (initialized) return;
  initialized = true;
  styles();
  const observer = new MutationObserver(() => {
    const map = document.querySelector(".setom-map-canvas");
    if (!map) return;
    if (!document.getElementById(ROOT_ID)) {
      const host = document.createElement("section");
      host.id = ROOT_ID;
      map.parentElement?.appendChild(host);
      render();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("setom:planning-updated", () => { if (document.getElementById(ROOT_ID)) render(); });
  setTimeout(() => {
    const map = document.querySelector(".setom-map-canvas");
    if (map && !document.getElementById(ROOT_ID)) { const host=document.createElement("section"); host.id=ROOT_ID; map.parentElement?.appendChild(host); render(); }
  }, 500);
}

install();
