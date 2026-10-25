import { supabase } from "./supabase";
import { buildPlanningAssignments } from "./planningEngine";

const PLANIFIABLE = ["À planifier", "Planifié"];
const ROLES = ["admin", "bureau"];
const BASELINE_M2 = 30;

function fullOsNumber(order, osLabel = "OS") {
  return `${String(osLabel).trim() || "OS"}-${new Date(order.creation_date).getFullYear()}-${String(order.os_number).padStart(5, "0")}`;
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function findStartDate() {
  const selected = document.querySelector(".setom-month-cell.selected[data-date]")?.dataset?.date;
  if (selected) return selected;
  const dateInput = document.querySelector('.setom-map-order input[type="date"]');
  if (dateInput?.value) return dateInput.value;
  return todayISO();
}

async function runPlanningV5() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;
  if (authError || !user) throw new Error("Connexion requise pour planifier automatiquement.");

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.active || !ROLES.includes(profile.role)) throw new Error("Votre profil ne permet pas de planifier les interventions.");

  const [{ data: rows, error: workOrderError }, { data: teams, error: teamsError }, { data: materials, error: materialsError }, { data: sectors, error: sectorsError }] = await Promise.all([
    supabase.from("work_orders").select("id, os_number, creation_date, address, postal_code, city, sector_id, material_detail, planned_surface_m2, status, deadline_date, is_night").order("os_number", { ascending: true }),
    supabase.from("teams").select("id, name, active, usual_sector_id, indicative_capacity").order("name"),
    supabase.from("materials").select("id, name, category, active, planning_difficulty, indicative_capacity_m2, sort_order").order("sort_order", { ascending: true }),
    supabase.from("sectors").select("id, name, active, sort_order").order("sort_order", { ascending: true }),
  ]);
  if (workOrderError) throw workOrderError;
  if (teamsError) throw teamsError;
  if (materialsError) throw materialsError;
  if (sectorsError) throw sectorsError;

  const workOrders = rows || [];
  const activeTeams = (teams || []).filter((team) => team.active !== false);
  const activeMaterials = (materials || []).filter((material) => material.active !== false);
  const activeSectors = (sectors || []).filter((sector) => sector.active !== false);
  if (!activeTeams.length) throw new Error("Aucune équipe active. Créez d'abord les équipes.");

  const ids = workOrders.map((row) => row.id);
  let interventions = [];
  if (ids.length) {
    const { data, error } = await supabase.from("interventions").select("id, work_order_id, team_id, planned_date, planned_order, status").in("work_order_id", ids);
    if (error) throw error;
    interventions = data || [];
  }

  const { data: tasks, error: taskError } = await supabase
    .from("planning_tasks")
    .select("id, task_date, team_id, title, category, planned_order")
    .order("task_date", { ascending: true });
  if (taskError) throw taskError;

  const interventionByOrder = new Map();
  for (const item of interventions) {
    const previous = interventionByOrder.get(item.work_order_id);
    if (!previous || (!previous.planned_date && item.planned_date)) interventionByOrder.set(item.work_order_id, item);
  }
  const sectorById = new Map(activeSectors.map((sector) => [sector.id, sector.name]));
  const orders = workOrders.map((row) => {
    const intervention = interventionByOrder.get(row.id);
    return {
      ...row,
      sector_name: sectorById.get(row.sector_id) || "Non classé",
      interventionId: intervention?.id || null,
      intervention_status: intervention?.status || null,
      planned_date: intervention?.planned_date || null,
      planned_order: Number(intervention?.planned_order || 0),
      team_id: intervention?.team_id || null,
    };
  });

  const inconsistent = orders.filter((order) => PLANIFIABLE.includes(order.status) && !order.planned_date && order.intervention_status && !PLANIFIABLE.includes(order.intervention_status));
  const queue = orders.filter((order) => PLANIFIABLE.includes(order.status) && !order.planned_date && (!order.intervention_status || PLANIFIABLE.includes(order.intervention_status)));
  if (!queue.length) {
    throw new Error(inconsistent.length
      ? `${inconsistent.length} OS ont un statut d'intervention incohérent avec leur statut OS. Ils ont été laissés intacts.`
      : "Aucun OS à planifier automatiquement.");
  }

  const blockedTeamDates = new Set((tasks || [])
    .filter((task) => task.task_date && task.team_id)
    .map((task) => `${task.task_date}|${task.team_id}`));

  const startDate = findStartDate();
  const result = buildPlanningAssignments({
    orders,
    teams: activeTeams,
    materials: activeMaterials,
    startDate,
    horizonDays: 120,
    baselineDailyCapacityM2: BASELINE_M2,
    marginPercent: 0,
    blockedTeamDates,
  });

  const lateAssignments = result.assignments.filter((assignment) => {
    const order = queue.find((item) => item.id === assignment.work_order_id);
    return order?.deadline_date && assignment.planned_date > order.deadline_date;
  });

  if (lateAssignments.length) {
    const preview = lateAssignments.slice(0, 5).map((assignment) => {
      const order = queue.find((item) => item.id === assignment.work_order_id);
      return `${fullOsNumber(order)} → ${new Date(`${assignment.planned_date}T12:00:00`).toLocaleDateString("fr-FR")} (échéance ${new Date(`${order.deadline_date}T12:00:00`).toLocaleDateString("fr-FR")})`;
    }).join("\n");
    const more = lateAssignments.length > 5 ? "\n…" : "";
    if (!window.confirm(`${lateAssignments.length} OS seraient planifiés après leur échéance contractuelle.\n\n${preview}${more}\n\nContinuer quand même ?`)) return { cancelled: true };
  }

  const { data: applied, error: applyError } = await supabase.rpc("apply_setom_planning_batch", {
    p_assignments: result.assignments,
    p_user_id: user.id,
  });
  if (applyError) throw applyError;
  if (Number(applied?.planned_count) !== result.assignments.length) throw new Error("La base n'a pas confirmé la planification de tous les OS.");

  return { assignments: result.assignments, warnings: result.warnings, inconsistent, lateAssignments };
}

let running = false;

async function handlePlanningClick(event) {
  const button = event.target?.closest?.("button");
  if (!button || !button.textContent.includes("Planifier automatiquement")) return;
  if (running) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  running = true;
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = "Planification V5…";

  try {
    const confirmed = window.confirm("Lancer la planification V5 ?\n\nSETOM va appliquer :\n• priorité aux échéances contractuelles\n• référence 30 m² / équipe de 6\n• un seul matériau par journée\n• grosses pièces > 6 m² favorisées le matin\n• circulation forte repoussée après le matin\n• secteurs habituels des équipes\n• tâches libres comme indisponibilités\n\nLes OS déjà planifiés ne seront pas déplacés.");
    if (!confirmed) return;

    const result = await runPlanningV5();
    if (result?.cancelled) return;
    window.dispatchEvent(new Event("setom:planning-updated"));

    const lateText = result.lateAssignments.length ? `\n\n⚠️ ${result.lateAssignments.length} OS dépassent leur échéance dans cette proposition.` : "";
    const inconsistentText = result.inconsistent.length ? `\n\n${result.inconsistent.length} OS incohérents ont été laissés intacts.` : "";
    alert(`✅ ${result.assignments.length} OS planifiés avec le moteur V5.${lateText}${inconsistentText}\n\nVérifiez ensuite le planning et la carte avant l'envoi aux équipes.`);
  } catch (error) {
    console.error("SETOM planning V5 :", error);
    alert(`Impossible d'appliquer la planification V5 : ${error?.message || "erreur inconnue"}`);
  } finally {
    running = false;
    button.disabled = false;
    button.textContent = originalText;
  }
}

document.addEventListener("click", handlePlanningClick, true);
