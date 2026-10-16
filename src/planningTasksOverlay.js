import { supabase } from "./supabase";
import "./planningTasksOverlay.css";

const TASK_STATUSES = ["À faire", "En cours", "Terminée", "Annulée"];
const TASK_PRIORITIES = ["Basse", "Normale", "Haute", "Urgente"];
const dateIso = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const esc = (value) => String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));

let profile = null;
let teams = [];
let sectors = [];
let tasks = [];
let observer = null;
let renderTimer = null;

async function loadContext() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return false;
  const profileResult = await supabase.from("user_profiles").select("id,role,active").eq("id", auth.user.id).maybeSingle();
  profile = profileResult.data;
  if (!profile?.active || !["admin", "bureau"].includes(profile.role)) return false;
  const [teamResult, sectorResult] = await Promise.all([
    supabase.from("teams").select("id,name,active").order("name"),
    supabase.from("sectors").select("id,name,active").order("sort_order")
  ]);
  teams = (teamResult.data || []).filter((x) => x.active !== false);
  sectors = (sectorResult.data || []).filter((x) => x.active !== false);
  return true;
}

async function loadTasks() {
  const { data, error } = await supabase.from("planning_tasks").select("*").order("task_date").order("planned_order").order("start_time");
  if (error) {
    console.warn("[SETOM] Tâches libres indisponibles :", error.message);
    return false;
  }
  tasks = data || [];
  return true;
}

function getSelectedDate() {
  const monthSelected = document.querySelector(".setom-month-cell.selected");
  if (monthSelected) {
    const text = monthSelected.querySelector(".setom-month-day span")?.textContent?.trim();
    const now = new Date();
    if (text) return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(text).padStart(2, "0")}`;
  }
  const dateInput = document.querySelector('.setom-planner input[type="date"]');
  if (dateInput?.value) return dateInput.value;
  return dateIso();
}

function taskCard(task, compact = false) {
  const time = [task.start_time?.slice(0, 5), task.end_time?.slice(0, 5)].filter(Boolean).join("–");
  return `<article class="setom-free-task ${compact ? "compact" : ""}" data-task-id="${esc(task.id)}" style="--task-color:${esc(task.color || "#f59e0b")}">
    <div class="setom-free-task-marker"></div>
    <div class="setom-free-task-main">
      <strong>📝 ${esc(task.title)}</strong>
      ${time ? `<span class="setom-free-task-time">${esc(time)}</span>` : ""}
      ${task.team_id ? `<span>Équipe : ${esc(teams.find((t) => t.id === task.team_id)?.name || "Équipe")}</span>` : ""}
      ${task.address ? `<span>${esc(task.address)}</span>` : ""}
      ${!compact && task.description ? `<small>${esc(task.description)}</small>` : ""}
      <span class="setom-free-task-meta">${esc(task.status)} · ${esc(task.priority)}</span>
    </div>
    <div class="setom-free-task-actions">
      <button type="button" data-task-action="status" data-status="${esc(task.status)}" title="Changer le statut">${task.status === "Terminée" ? "↩" : "✓"}</button>
      <button type="button" data-task-action="delete" title="Supprimer">×</button>
    </div>
  </article>`;
}

function renderTaskLists() {
  document.querySelectorAll(".setom-free-task-list").forEach((node) => node.remove());
  const selected = getSelectedDate();
  const dayTasks = tasks.filter((task) => task.task_date === selected);
  const dayView = document.querySelector(".setom-day-view");
  if (dayView && dayTasks.length) {
    dayView.insertAdjacentHTML("beforeend", `<section class="setom-free-task-list"><header><strong>📝 Tâches libres</strong><span>${dayTasks.length}</span></header>${dayTasks.map((t) => taskCard(t)).join("")}</section>`);
  }
  const binder = document.querySelector(".setom-binder");
  if (binder && dayTasks.length) {
    binder.insertAdjacentHTML("beforeend", `<section class="setom-free-task-list binder"><header><strong>📝 Tâches libres du jour</strong><span>${dayTasks.length}</span></header>${dayTasks.map((t) => taskCard(t)).join("")}</section>`);
  }
  document.querySelectorAll(".setom-week-binder-day").forEach((section) => {
    const dateText = section.querySelector("header span")?.textContent || "";
    const match = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return;
    const date = `${match[3]}-${match[2]}-${match[1]}`;
    const items = tasks.filter((task) => task.task_date === date);
    if (items.length) section.insertAdjacentHTML("beforeend", `<div class="setom-free-task-week">${items.map((t) => taskCard(t, true)).join("")}</div>`);
  });
}

function openModal() {
  if (document.querySelector(".setom-free-task-modal")) return;
  const selectedDate = getSelectedDate();
  const teamOptions = teams.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("");
  const sectorOptions = sectors.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
  const modal = document.createElement("div");
  modal.className = "setom-free-task-modal";
  modal.innerHTML = `<div class="setom-free-task-dialog">
    <header><div><span>PLANNING</span><h3>📝 Ajouter une tâche libre</h3><p>Cette tâche sera visible dans le planning et le classeur, sans créer d'OS.</p></div><button type="button" data-close>×</button></header>
    <form>
      <label>Intitulé *<input name="title" required placeholder="Ex. Réunion chantier, entretien camion…" autofocus></label>
      <div class="setom-task-grid">
        <label>Date *<input type="date" name="task_date" value="${selectedDate}" required></label>
        <label>Équipe<select name="team_id"><option value="">Aucune équipe</option>${teamOptions}</select></label>
        <label>Début<input type="time" name="start_time"></label>
        <label>Fin<input type="time" name="end_time"></label>
        <label>Priorité<select name="priority">${TASK_PRIORITIES.map((x) => `<option>${x}</option>`).join("")}</select></label>
        <label>Secteur<select name="sector_id"><option value="">Aucun secteur</option>${sectorOptions}</select></label>
      </div>
      <label>Adresse / lieu<input name="address" placeholder="Facultatif"></label>
      <label>Description<textarea name="description" rows="3" placeholder="Informations utiles à l'équipe…"></textarea></label>
      <footer><button type="button" class="secondary" data-close>Annuler</button><button type="submit" class="primary">Ajouter au planning</button></footer>
    </form>
  </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", close));
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  modal.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    if (!title) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return alert("Connexion requise.");
    const payload = {
      title,
      description: String(form.get("description") || "").trim() || null,
      task_date: form.get("task_date"),
      start_time: form.get("start_time") || null,
      end_time: form.get("end_time") || null,
      team_id: form.get("team_id") || null,
      sector_id: form.get("sector_id") || null,
      address: String(form.get("address") || "").trim() || null,
      priority: form.get("priority") || "Normale",
      created_by: auth.user.id,
      updated_by: auth.user.id,
      planned_order: tasks.filter((t) => t.task_date === form.get("task_date")).length + 1,
    };
    const { error } = await supabase.from("planning_tasks").insert(payload);
    if (error) return alert("Impossible d'ajouter la tâche : " + error.message);
    close();
    await loadTasks();
    renderTaskLists();
    window.dispatchEvent(new Event("setom:planning-updated"));
  });
}

async function handleTaskAction(event) {
  const button = event.target.closest?.("[data-task-action]");
  if (!button) return;
  const card = button.closest("[data-task-id]");
  const task = tasks.find((x) => x.id === card?.dataset.taskId);
  if (!task) return;
  const action = button.dataset.taskAction;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return;
  if (action === "delete") {
    if (!window.confirm(`Supprimer la tâche « ${task.title} » ?`)) return;
    const { error } = await supabase.from("planning_tasks").delete().eq("id", task.id);
    if (error) return alert(error.message);
  } else {
    const next = task.status === "Terminée" ? "À faire" : task.status === "À faire" ? "En cours" : "Terminée";
    const { error } = await supabase.from("planning_tasks").update({ status: next, updated_by: auth.user.id }).eq("id", task.id);
    if (error) return alert(error.message);
  }
  await loadTasks();
  renderTaskLists();
}

function addButton() {
  if (document.querySelector("[data-setom-add-free-task]")) return;
  const nav = document.querySelector(".setom-plan-nav");
  if (!nav) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.setomAddFreeTask = "true";
  button.textContent = "📝 Tâche libre";
  button.title = "Ajouter une tâche qui n'est pas liée à un OS";
  button.addEventListener("click", openModal);
  nav.appendChild(button);
}

async function init() {
  try {
    if (!(await loadContext())) return;
    await loadTasks();
    addButton();
    renderTaskLists();
    observer = new MutationObserver(() => {
      clearTimeout(renderTimer);
      renderTimer = setTimeout(() => { addButton(); renderTaskLists(); }, 120);
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("setom:planning-updated", async () => { await loadTasks(); renderTaskLists(); });
  } catch (error) {
    console.warn("[SETOM] Module tâches libres non chargé :", error);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
