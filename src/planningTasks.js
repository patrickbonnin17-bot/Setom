export const PLANNING_TASK_TYPES = [
  "Réunion",
  "Livraison",
  "Entretien camion",
  "Panne / immobilisation",
  "Panneaux de stationnement",
  "Récupération de matériel",
  "Autre",
];

export const PLANNING_TASK_STATUSES = ["Planifiée", "En cours", "Terminée", "Annulée"];

export function normalizePlanningTask(row) {
  return {
    ...row,
    kind: "task",
    title: String(row?.title || "Tâche libre").trim(),
    task_type: String(row?.task_type || "Autre"),
    task_date: row?.task_date || null,
    all_day: row?.all_day !== false,
    start_time: row?.start_time || null,
    end_time: row?.end_time || null,
    team_id: row?.team_id || null,
    location: row?.location || "",
    notes: row?.notes || "",
    status: row?.status || "Planifiée",
  };
}

export function planningTaskOccupiesTeam(task, teamId) {
  if (!task || task.status === "Annulée") return false;
  return !teamId || task.team_id === teamId;
}

export function planningTaskLabel(task) {
  const type = String(task?.task_type || "Autre");
  const title = String(task?.title || "Tâche libre");
  return type === "Autre" ? title : `${type} · ${title}`;
}
