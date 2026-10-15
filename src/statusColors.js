export const OS_STATUS_LEGEND = [
  { label: "Nouveaux OS", statuses: ["Nouveau OS"], accent: "#EAB308", background: "#FEF9C3", text: "#854D0E", border: "#FDE047" },
  { label: "Planifié", statuses: ["Planifié"], accent: "#F97316", background: "#FFEDD5", text: "#9A3412", border: "#FDBA74" },
  { label: "En attente", statuses: ["En attente"], accent: "#64748B", background: "#F1F5F9", text: "#334155", border: "#CBD5E1" },
  { label: "Travaux réalisés", statuses: ["Travaux réalisés"], accent: "#2563EB", background: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD" },
  { label: "À vérifier", statuses: ["À vérifier"], accent: "#7C3AED", background: "#EDE9FE", text: "#5B21B6", border: "#C4B5FD" },
  { label: "Validé", statuses: ["Validé"], accent: "#16A34A", background: "#DCFCE7", text: "#166534", border: "#86EFAC" },
  { label: "Réserve", statuses: ["Réserve"], accent: "#DC2626", background: "#FEE2E2", text: "#991B1B", border: "#FCA5A5" },
  { label: "Payé", statuses: ["Payé"], accent: "#15803D", background: "#BBF7D0", text: "#14532D", border: "#4ADE80" },
  { label: "Archivé", statuses: ["Archivé"], accent: "#64748B", background: "#F1F5F9", text: "#334155", border: "#CBD5E1" },
  { label: "En erreur", statuses: ["En erreur"], accent: "#B91C1C", background: "#FEE2E2", text: "#7F1D1D", border: "#FCA5A5" },
  { label: "Annulé / doublon", statuses: ["Doublon", "Annulé"], accent: "#6B7280", background: "#F3F4F6", text: "#374151", border: "#D1D5DB" }
]

export function getOSStatusColors(status) {
  const normalized = String(status || "").trim().toLocaleLowerCase("fr-FR");
  const entry = OS_STATUS_LEGEND.find((item) => item.statuses.some((value) => value.toLocaleLowerCase("fr-FR") === normalized));
  return entry || { accent: "#64748B", background: "#F1F5F9", text: "#334155", border: "#CBD5E1" };
}

export function getOSStatusBadgeStyle(status) {
  const colors = getOSStatusColors(status);
  return {
    backgroundColor: colors.background,
    color: colors.text,
    border: "1px solid " + colors.border
  };
}
