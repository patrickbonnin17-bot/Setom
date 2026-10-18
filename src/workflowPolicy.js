// Canonical SETOM workflow policy.
// Legacy database labels remain readable; UI actions should use these helpers.

export const ROLES = Object.freeze({
  ADMIN: "admin",
  BUREAU: "bureau",
  TERRAIN: "equipe_terrain",
  CLIENT: "eau_de_toulouse",
});

export const STATUS = Object.freeze({
  NEW: "Nouveau", TO_PLAN: "À planifier", PLANNED: "Planifié", IN_WORK: "En travaux",
  WORK_DONE: "Travaux réalisés", CONTROL: "Contrôle", RESPONSIBLE_VALIDATED: "Validation responsable",
  CLIENT_PENDING: "En attente de validation client", CLIENT_VALIDATED: "Validé", RESERVE: "Réserve",
  CORRECTION: "Correction à réaliser", FINANCIAL: "Financier", PAID: "Payé", ARCHIVED: "Archivé",
  ERROR: "En erreur", CANCELLED: "Annulé", DUPLICATE: "Doublon",
});

const ALIASES = Object.freeze({
  "Travaux en cours": STATUS.IN_WORK,
  "Travaux effectués": STATUS.WORK_DONE,
  "Constat à vérifier": STATUS.CONTROL,
  "Constat de facturation": STATUS.CONTROL,
  "À vérifier": STATUS.CONTROL,
  "À valider": STATUS.CONTROL,
  "Validé avec réserve": STATUS.RESERVE,
});

export const normalizeOSStatus = (value) => {
  const raw = String(value || "").trim();
  return ALIASES[raw] || raw;
};

export const isOperationallyActive = (value) => [STATUS.NEW, STATUS.TO_PLAN, STATUS.PLANNED, STATUS.IN_WORK].includes(normalizeOSStatus(value));
export const isWorkEditable = (value) => [STATUS.NEW, STATUS.TO_PLAN, STATUS.PLANNED, STATUS.IN_WORK].includes(normalizeOSStatus(value));
export const isWorkCompleted = (value) => normalizeOSStatus(value) === STATUS.WORK_DONE;
export const isConstatControl = (value) => normalizeOSStatus(value) === STATUS.CONTROL;
export const isClientPending = (value) => normalizeOSStatus(value) === STATUS.CLIENT_PENDING;
export const isClientValidated = (value) => normalizeOSStatus(value) === STATUS.CLIENT_VALIDATED;
export const isReserve = (value) => normalizeOSStatus(value) === STATUS.RESERVE;
export const isPaid = (value) => normalizeOSStatus(value) === STATUS.PAID;
export const isClosed = (value) => [STATUS.PAID, STATUS.ARCHIVED, STATUS.CANCELLED, STATUS.DUPLICATE].includes(normalizeOSStatus(value));

export const canEditOS = (role, status) => {
  if (![ROLES.ADMIN, ROLES.BUREAU, ROLES.TERRAIN].includes(role)) return false;
  return !isClosed(status) && ![STATUS.CLIENT_PENDING, STATUS.CLIENT_VALIDATED, STATUS.RESERVE, STATUS.FINANCIAL].includes(normalizeOSStatus(status));
};
export const canEditWork = (role, status) => [ROLES.ADMIN, ROLES.BUREAU, ROLES.TERRAIN].includes(role) && isWorkEditable(status);
export const canGenerateConstat = (status) => isWorkCompleted(status);
export const canControlConstat = (role, status) => [ROLES.ADMIN, ROLES.BUREAU].includes(role) && isConstatControl(status);
export const canValidateResponsable = (role, status, hasValidationPermission = false) => ([ROLES.ADMIN, ROLES.BUREAU].includes(role) || hasValidationPermission) && isConstatControl(status);
export const canSendToClient = (role, status) => [ROLES.ADMIN, ROLES.BUREAU].includes(role) && normalizeOSStatus(status) === STATUS.RESPONSIBLE_VALIDATED;
export const canClientValidate = (role, status) => role === ROLES.CLIENT && isClientPending(status);
export const canRegisterReserve = (role, status) => role === ROLES.CLIENT && isClientPending(status);
export const canEnterFinancial = (status) => isClientValidated(status);
export const canMarkPaid = (role, status) => [ROLES.ADMIN, ROLES.BUREAU].includes(role) && normalizeOSStatus(status) === STATUS.FINANCIAL;
export const canArchive = (role, status) => [ROLES.ADMIN, ROLES.BUREAU].includes(role) && isPaid(status);

// Explicit transition matrix: no screen should invent a direct status jump.
export const ALLOWED_TRANSITIONS = Object.freeze({
  [STATUS.NEW]: [STATUS.TO_PLAN, STATUS.ERROR, STATUS.CANCELLED, STATUS.DUPLICATE],
  [STATUS.TO_PLAN]: [STATUS.PLANNED, STATUS.NEW, STATUS.ERROR, STATUS.CANCELLED],
  [STATUS.PLANNED]: [STATUS.IN_WORK, STATUS.TO_PLAN, STATUS.ERROR, STATUS.CANCELLED],
  [STATUS.IN_WORK]: [STATUS.WORK_DONE, STATUS.PLANNED, STATUS.ERROR],
  [STATUS.WORK_DONE]: [STATUS.CONTROL],
  [STATUS.CONTROL]: [STATUS.RESPONSIBLE_VALIDATED, STATUS.CORRECTION],
  [STATUS.RESPONSIBLE_VALIDATED]: [STATUS.CLIENT_PENDING],
  [STATUS.CLIENT_PENDING]: [STATUS.CLIENT_VALIDATED, STATUS.RESERVE],
  [STATUS.RESERVE]: [STATUS.CORRECTION],
  [STATUS.CORRECTION]: [STATUS.IN_WORK, STATUS.CONTROL],
  [STATUS.CLIENT_VALIDATED]: [STATUS.FINANCIAL],
  [STATUS.FINANCIAL]: [STATUS.PAID],
  [STATUS.PAID]: [STATUS.ARCHIVED],
  [STATUS.ERROR]: [STATUS.NEW, STATUS.TO_PLAN],
});

export function canTransition(status, nextStatus) {
  const from = normalizeOSStatus(status);
  const to = normalizeOSStatus(nextStatus);
  return (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

export function getAllowedTransitions(status) {
  return ALLOWED_TRANSITIONS[normalizeOSStatus(status)] || [];
}

export function getNextWorkflowStatus(status) {
  return getAllowedTransitions(status)[0] || null;
}
