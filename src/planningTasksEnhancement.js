import { supabase } from "./supabase";

const TASK_CATEGORIES = [["reunion", "Réunion"], ["livraison", "Livraison"], ["entretien_camion", "Entretien camion"], ["panne", "Panne / immobilisation"], ["panneaux", "Panneaux de stationnement"], ["materiel", "Récupération de matériel"], ["autre", "Autre"]];
const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
let installed = false;
let observer = null;
let refreshTimer = null;
let tasks = [];
let modal = null;
let loading = false;

function pad(value) { return String(value).padStart(2, "0"); }
function iso(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function today() { return iso(new Date()); }
function esc(value) { return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char])); }
function categoryLabel(category) { return TASK_CATEGORIES.find(([key]) => key === category)?.[1] || "Tâche libre"; }
function parseFrenchDate(text) {
  const value = String(text || "").toLocaleLowerCase("fr-FR").trim();
  const match = value.match(/(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})?\s*(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*(\d{4})/i);
  if (!match) return null;
  const month = MONTHS.indexOf(match[2].toLocaleLowerCase("fr-FR"));
  return month >= 0 ? new Date(Number(match[3]), month, Number(match[1] || 1), 12) : null;
}
function displayedDate() { return parseFrenchDate(document.querySelector(".setom-plan-nav strong")?.textContent) || new Date(); }
function dateForMonthCell(index) {
  const base = displayedDate();
  const first = new Date(base.getFullYear(), base.getMonth(), 1, 12);
  const mondayOffset = (first.getDay() + 6) % 7;
  const date = new Date(first);
  date.setDate(1 - mondayOffset + index);
  return iso(date);
}
function dateForWeekColumn(index) {
  const base = displayedDate();
  const mondayOffset = (base.getDay() + 6) % 7;
  const date = new Date(base);
  date.setDate(base.getDate() - mondayOffset + index);
  return iso(date);
}
function selectedDateFromPlanner() { return iso(displayedDate()); }
function isOfficePlanner() { return Array.from(document.querySelectorAll(".setom-plan-nav button")).some((button) => button.textContent.includes("Planifier automatiquement")); }
async function loadTasks() {
  const { data, error } = await supabase.from("planning_tasks").select("id, task_date, team_id, title, category, notes, planned_order").order("task_date", { ascending: true }).order("planned_order", { ascending: true });
  if (error) { console.warn("SETOM : impossible de charger les tâches libres.", error); return; }
  tasks = data || [];
  renderTasks();
}
function tasksForDate(date) { return tasks.filter((task) => task.task_date === date); }
function teamName(teamId) { if (!teamId) return "Toutes équipes"; return Array.from(document.querySelectorAll("option")).find((item) => item.value === teamId)?.textContent || "Équipe"; }
function taskMarkup(task, compact = false) {
  const color = task.category === "panne" ? "#dc2626" : task.category === "reunion" ? "#7c3aed" : "#f59e0b";
  return `<span class="setom-free-task ${compact ? "compact" : ""}" data-free-task-id="${esc(task.id)}" style="--task-accent:${color}"><strong>▸ ${esc(task.title)}</strong><small>${esc(categoryLabel(task.category))}${task.team_id ? ` · ${esc(teamName(task.team_id))}` : ""}</small></span>`;
}
function clearRenderedTasks() { document.querySelectorAll("[data-setom-free-task-render]").forEach((node) => node.remove()); }
function renderTasks() {
  if (!document.querySelector("#setom-planner-host")) return;
  clearRenderedTasks();
  Array.from(document.querySelectorAll(".setom-month-cell")).forEach((cell, index) => {
    const date = dateForMonthCell(index);
    cell.dataset.date = date;
    const dayTasks = tasksForDate(date);
    if (!dayTasks.length) return;
    const wrapper = document.createElement("span");
    wrapper.dataset.setomFreeTaskRender = "true";
    wrapper.className = "setom-free-task-stack";
    wrapper.innerHTML = dayTasks.slice(0, 2).map((task) => taskMarkup(task, true)).join("");
    if (dayTasks.length > 2) wrapper.insertAdjacentHTML("beforeend", `<small class="setom-free-task-more">+ ${dayTasks.length - 2} tâche(s)</small>`);
    cell.appendChild(wrapper);
  });
  Array.from(document.querySelectorAll(".setom-week-col")).forEach((column, index) => {
    const dayTasks = tasksForDate(dateForWeekColumn(index));
    const body = column.querySelector(".setom-week-body");
    if (!body || !dayTasks.length) return;
    const wrapper = document.createElement("div");
    wrapper.dataset.setomFreeTaskRender = "true";
    wrapper.className = "setom-free-task-list";
    wrapper.innerHTML = dayTasks.map((task) => taskMarkup(task)).join("");
    body.prepend(wrapper);
  });
  const dayTitle = document.querySelector(".setom-day-title");
  const dayView = document.querySelector(".setom-day-view");
  if (dayTitle && dayView) {
    const dayTasks = tasksForDate(selectedDateFromPlanner());
    if (dayTasks.length) {
      const wrapper = document.createElement("div");
      wrapper.dataset.setomFreeTaskRender = "true";
      wrapper.className = "setom-free-task-day-list";
      wrapper.innerHTML = dayTasks.map((task) => taskMarkup(task)).join("");
      dayTitle.insertAdjacentElement("afterend", wrapper);
    }
  }
}
function openModal() {
  if (modal) return;
  const teams = Array.from(document.querySelectorAll("option")).map((option) => ({ value: option.value, label: option.textContent })).filter((item, index, list) => item.value && list.findIndex((other) => other.value === item.value) === index && !item.label.includes("Équipe") && !item.label.includes("Non affectée"));
  modal = document.createElement("div");
  modal.className = "setom-free-task-modal-backdrop";
  modal.innerHTML = `<div class="setom-free-task-modal" role="dialog" aria-modal="true" aria-label="Ajouter une tâche libre"><div class="setom-free-task-modal-head"><div><strong>Ajouter une tâche libre</strong><small>Une tâche affectée à une équipe bloque sa journée dans le planning.</small></div><button type="button" data-task-close>✕</button></div><form data-task-form><label>Intitulé<input name="title" required maxlength="120" placeholder="Ex. Entretien du camion PL" /></label><div class="setom-free-task-grid"><label>Date<input name="task_date" type="date" value="${selectedDateFromPlanner()}" required /></label><label>Catégorie<select name="category">${TASK_CATEGORIES.map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></label></div><label>Équipe<select name="team_id"><option value="">Aucune équipe</option>${teams.map((team) => `<option value="${esc(team.value)}">${esc(team.label)}</option>`).join("")}</select></label><label>Commentaire<textarea name="notes" rows="3" maxlength="500" placeholder="Précision utile pour le planning…"></textarea></label><div class="setom-free-task-modal-actions"><button type="button" data-task-close>Annuler</button><button class="primary" type="submit">Enregistrer la tâche</button></div><p class="setom-free-task-modal-error" data-task-error></p></form></div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-task-close]").forEach((button) => button.addEventListener("click", closeModal));
  modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
  modal.querySelector("[data-task-form]").addEventListener("submit", saveTask);
}
function closeModal() { modal?.remove(); modal = null; }
async function saveTask(event) {
  event.preventDefault();
  if (loading) return;
  loading = true;
  const form = event.currentTarget;
  const errorNode = form.querySelector("[data-task-error]");
  errorNode.textContent = "";
  const data = new FormData(form);
  const taskDate = String(data.get("task_date") || "");
  const teamId = String(data.get("team_id") || "") || null;
  const title = String(data.get("title") || "").trim();
  const category = String(data.get("category") || "autre");
  const notes = String(data.get("notes") || "").trim();
  try {
    if (!title || !taskDate) throw new Error("L'intitulé et la date sont obligatoires.");
    if (teamId) {
      const { data: existingTasks, error: taskCheckError } = await supabase.from("planning_tasks").select("id").eq("task_date", taskDate).eq("team_id", teamId);
      if (taskCheckError) throw taskCheckError;
      if ((existingTasks || []).length) throw new Error("Cette équipe possède déjà une tâche libre ce jour-là.");
      const { data: existingInterventions, error: interventionCheckError } = await supabase.from("interventions").select("id").eq("planned_date", taskDate).eq("team_id", teamId).limit(1);
      if (interventionCheckError) throw interventionCheckError;
      if ((existingInterventions || []).length) throw new Error("Cette équipe a déjà une intervention planifiée ce jour-là. Déplacez-la avant de bloquer la journée.");
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error("Connexion requise pour créer une tâche.");
    const { error } = await supabase.from("planning_tasks").insert({ task_date: taskDate, team_id: teamId, title, category, notes: notes || null, planned_order: 1, created_by: authData.user.id });
    if (error) throw error;
    closeModal();
    await loadTasks();
    window.dispatchEvent(new Event("setom:planning-updated"));
  } catch (saveError) { console.error("SETOM : création de tâche libre impossible.", saveError); errorNode.textContent = saveError?.message || "Impossible d'enregistrer la tâche."; }
  finally { loading = false; }
}
function addButton() {
  const nav = document.querySelector(".setom-plan-nav");
  if (!nav || !isOfficePlanner() || nav.querySelector("[data-add-free-task]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.addFreeTask = "true";
  button.textContent = "+ Tâche libre";
  button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); openModal(); });
  nav.appendChild(button);
}
function installStyles() {
  if (document.getElementById("setom-free-task-styles")) return;
  const style = document.createElement("style");
  style.id = "setom-free-task-styles";
  style.textContent = `.setom-free-task-stack,.setom-free-task-list,.setom-free-task-day-list{display:flex;flex-direction:column;gap:4px;margin-top:5px}.setom-free-task{display:flex;flex-direction:column;gap:2px;padding:7px 9px;border-left:3px solid var(--task-accent,#f59e0b);background:#fff8e7;border-radius:6px;text-align:left;font-size:11px;color:#334155;box-sizing:border-box}.setom-free-task strong{font-size:11px}.setom-free-task small{font-size:10px;color:#64748b}.setom-free-task.compact{padding:4px 6px;font-size:9px}.setom-free-task.compact small{font-size:9px}.setom-free-task-more{font-size:10px;color:#64748b;padding-left:4px}.setom-free-task-day-list{margin-bottom:10px}.setom-free-task-list{margin-bottom:8px}.setom-free-task-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.52);display:flex;align-items:center;justify-content:center;z-index:2147483647;padding:20px}.setom-free-task-modal{width:min(520px,100%);background:white;border-radius:16px;box-shadow:0 24px 80px rgba(15,23,42,.3);padding:20px;color:#0f172a}.setom-free-task-modal-head{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;margin-bottom:18px}.setom-free-task-modal-head strong{display:block;font-size:18px}.setom-free-task-modal-head small{display:block;margin-top:4px;color:#64748b}.setom-free-task-modal-head button{border:0;background:#f1f5f9;border-radius:8px;width:32px;height:32px;cursor:pointer}.setom-free-task-modal form{display:flex;flex-direction:column;gap:13px}.setom-free-task-modal label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:#334155}.setom-free-task-modal input,.setom-free-task-modal select,.setom-free-task-modal textarea{font:inherit;font-weight:400;border:1px solid #cbd5e1;border-radius:8px;padding:9px;background:white}.setom-free-task-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.setom-free-task-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:5px}.setom-free-task-modal-actions button{border:1px solid #cbd5e1;background:white;border-radius:8px;padding:9px 14px;cursor:pointer}.setom-free-task-modal-actions .primary{border-color:#175cd3;background:#175cd3;color:white}.setom-free-task-modal-error{margin:0;color:#b91c1c;font-size:12px;min-height:16px}@media(max-width:700px){.setom-free-task-grid{grid-template-columns:1fr}.setom-free-task-modal-backdrop{padding:10px}}`;
  document.head.appendChild(style);
}
function install() {
  if (installed) return;
  installed = true;
  installStyles();
  observer = new MutationObserver(() => {
    const host = document.querySelector("#setom-planner-host");
    if (!host) return;
    addButton();
    if (!tasks.length) loadTasks(); else renderTasks();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("setom:planning-updated", loadTasks);
}
install();
