// Canonical SETOM workflow policy.
// Keep legacy database status spellings readable, but use these helpers for all UI transitions.

export const ROLES = Object.freeze({
  ADMIN: "admin",
  BUREAU: "bureau",
  TERRAIN: "equipe_terrain",
  CLIENT: "eau_de_toulouse",
});

export const STATUS = Object.freeze({
  NEW: "Nouveau",
  TO_PLAN: "À planifier",
  PLANNED: "Planifié",
  IN_WORK: "En travaux",
  WORK_DONE: "Travaux réalisés",
  CONSTAT_REVIEW: "Contrôle",
  RESPONSIBLE_VALIDATED: "Validation responsable",
  CLIENT_PENDING: "En attente de validation client",
  CLIENT_VALIDATED: "Validé",
  RESERVE: "Réserve",
  FINANCIAL: "Financier",
  PAID: "Payé",
  ARCHIVED: "Archivé",
  ERROR: "En erreur",
  CANCELLED: "Annulé",
  DUPLICATE: "Doublon",
});

const ALIASES = Object.freeze({
  "Travaux en cours": STATUS.IN_WORK,
  "Travaux effectués": STATUS.WORK_DONE,
  "Constat à vérifier": STATUS.CONSTAT_REVIEW,
  "Constat de facturation": STATUS.CONSTAT_REVIEW,
  "À vérifier": STATUS.CONSTAT_REVIEW,
  "À valider": STATUS.CONSTAT_REVIEW,
  "Validé avec réserve": STATUS.RESERVE,
});

export const normalizeOSStatus = (value) => {
  const raw = String(value || "").trim();
  return ALIASES[raw] || raw;
};

export const isOperationallyActive = (value) => [
  STATUS.NEW, STATUS.TO_PLAN, STATUS.PLANNED, STATUS.IN_WORK,
].includes(normalizeOSStatus(value));

export const isWorkEditable = (value) => [
  STATUS.NEW, STATUS.TO_PLAN, STATUS.PLANNED, STATUS.IN_WORK,
].includes(normalizeOSStatus(value));

export const isWorkCompleted = (value) => normalizeOSStatus(value) === STATUS.WORK_DONE;

export const isConstatReview = (value) => normalizeOSStatus(value) === STATUS.CONSTAT_REVIEW;

export const isClientPending = (value) => normalizeOSStatus(value) === STATUS.CLIENT_PENDING;

export const isClientValidated = (value) => normalizeOSStatus(value) === STATUS.CLIENT_VALIDATED;

export const isReserve = (value) => normalizeOSStatus(value) === STATUS.RESERVE;

export const isPaid = (value) => normalizeOSStatus(value) === STATUS.PAID;

export const isClosed = (value) => [STATUS.PAID, STATUS.ARCHIVED, STATUS.CANCELLED, STATUS.DUPLICATE].includes(normalizeOSStatus(value));

export const canEditOS = (role, status) => {
  if (![ROLES.ADMIN, ROLES.BUREAU, ROLES.TERRAIN].includes(role)) return false;
  return !isClosed(status) && ![STATUS.CLIENT_PENDING, STATUS.CLIENT_VALIDATED, STATUS.RESERVE, STATUS.FINANCIAL].includes(normalizeOSStatus(status));
};

export const canEditWork = (role, status) => {
  if (![ROLES.ADMIN, ROLES.BUREAU, ROLES.TERRAIN].includes(role)) return false;
  return isWorkEditable(status);
};

export const canGenerateConstat = (status) => isWorkCompleted(status);

export const canControlConstat = (role, status) => {
  if (![ROLES.ADMIN, ROLES.BUREAU].includes(role)) return false;
  return isConstatReview(status);
};

export const canValidateResponsable = (role, status) => {
  if (![ROLES.ADMIN, ROLES.BUREAU].includes(role)) return false;
  return isConstatReview(status);
};

export const canSendToClient = (role, status) => {
  if (![ROLES.ADMIN, ROLES.BUREAU].includes(role)) return false;
  return normalizeOSStatus(status) === STATUS.RESPONSIBLE_VALIDATED;
};

export const canClientValidate = (role, status) => {
  return role === ROLES.CLIENT && isClientPending(status);
};

export const canRegisterReserve = (role, status) => {
  return role === ROLES.CLIENT && isClientPending(status);
};

export const canEnterFinancial = (status) => isClientValidated(status);

export const canMarkPaid = (role, status) => {
  if (![ROLES.ADMIN, ROLES.BUREAU].includes(role)) return false;
  return normalizeOSStatus(status) === STATUS.FINANCIAL;
};

export const canArchive = (role, status) => {
  if (![ROLES.ADMIN, ROLES.BUREAU].includes(role)) return false;
  return isPaid(status);
};

export const NEXT_STEP = Object.freeze({
  [STATUS.NEW]: STATUS.TO_PLAN,
  [STATUS.TO_PLAN]: STATUS.PLANNED,
  [STATUS.PLANNED]: STATUS.IN_WORK,
  [STATUS.IN_WORK]: STATUS.WORK_DONE,
  [STATUS.WORK_DONE]: STATUS.CONSTAT_REVIEW,
  [STATUS.CONSTAT_REVIEW]: STATUS.RESPONSIBLE_VALIDATED,
  [STATUS.RESPONSIBLE_VALIDATED]: STATUS.CLIENT_PENDING,
  [STATUS.CLIENT_PENDING]: STATUS.CLIENT_VALIDATED,
  [STATUS.CLIENT_VALIDATED]: STATUS.FINANCIAL,
  [STATUS.FINANCIAL]: STATUS.PAID,
  [STATUS.PAID]: STATUS.ARCHIVED,
});

export function getNextWorkflowStatus(status) {
  return NEXT_STEP[normalizeOSStatus(status)] || null;
}
