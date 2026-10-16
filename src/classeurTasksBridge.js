import { supabase } from "./supabase";

const ROOT_ID = "setom-classeur-tasks-bridge";
let timer = null;
let busy = false;

function esc(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
}

function dateValue() {
  const input = document.querySelector(".setom-map-order input[type='date'], input[type='date'][value]");
  return input?.value || new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

function findHost() {
  const binder = document.querySelector(".setom-binder-card, .setom-week-binder-row");
  if (!binder) return null;
  return binder.closest("section,main,div") || document.body;
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

function ensureStyle() {
  if (document.getElementById("setom-classeur-tasks-style")) return;
  const style = document.createElement("style");
  style.id = "setom-classeur-tasks-style";
  style.textContent = `
    #${ROOT_ID}{margin:14px 0;padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;box-shadow:0 4px 18px rgba(15,23,42,.06);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    #${ROOT_ID} .setom-ct-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
    #${ROOT_ID} .setom-ct-title{margin:0;font-size:17px;color:#17202a;font-weight:800}
    #${ROOT_ID} .setom-ct-sub{font-size:12px;color:#667085;margin-top:3px}
    #${ROOT_ID} .setom-ct-list{display:grid;gap:7px}
    #${ROOT_ID} .setom-ct-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #edf0f4;border-radius:11px;background:#f8fafc}
    #${ROOT_ID} .setom-ct-icon{width:30px;height:30px;border-radius:8px;background:#eef4ff;display:grid;place-items:center;flex:0 0 auto}
    #${ROOT_ID} .setom-ct-main{min-width:0;flex:1}.setom-ct-main strong{display:block;font-size:13px;color:#17202a}.setom-ct-main span{display:block;margin-top:2px;font-size:11px;color:#667085;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #${ROOT_ID} .setom-ct-empty{padding:10px 0;color:#98a2b3;font-size:12px}
    #${ROOT_ID} .setom-ct-print{border:1px solid #d0d5dd;background:#fff;border-radius:9px;padding:7px 10px;font-weight:800;cursor:pointer}
    @media print{#${ROOT_ID}{box-shadow:none;break-inside:avoid}.setom-ct-print{display:none}}
  `;
  document.head.appendChild(style);
}

async function render() {
  if (busy) return;
  const host = findHost();
  if (!host) return;
  busy = true;
  try {
    ensureStyle();
    const date = dateValue();
    const [tasks, teams] = await Promise.all([loadTasks(date), loadTeams()]);
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("section");
      root.id = ROOT_ID;
      host.prepend(root);
    }
    root.innerHTML = `<div class="setom-ct-head"><div><h3 class="setom-ct-title">🛠️ Tâches du jour</h3><div class="setom-ct-sub">${esc(formatDate(date))} · tâches hors OS intégrées au classeur</div></div><button type="button" class="setom-ct-print">🖨️ Imprimer le classeur</button></div><div class="setom-ct-list">${tasks.length ? tasks.map((task) => { const team = teams.find((item) => item.id === task.team_id); return `<div class="setom-ct-row"><div class="setom-ct-icon">🛠️</div><div class="setom-ct-main"><strong>${esc(task.title)}</strong><span>${esc(team?.name || "Non affectée")}${task.notes ? " · " + esc(task.notes) : ""}</span></div></div>`; }).join("") : `<div class="setom-ct-empty">Aucune tâche libre pour cette journée.</div>`}</div>`;
    root.querySelector(".setom-ct-print")?.addEventListener("click", () => window.print());
  } catch (error) {
    console.error("SETOM classeur tasks:", error);
  } finally {
    busy = false;
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(render, 180);
}

function install() {
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("change", (event) => {
    if (event.target?.matches?.("input[type='date'], select")) schedule();
  });
  window.addEventListener("setom:planning-updated", schedule);
  schedule();
}

install();
