export const DOSSIER_TYPES = {
  EXTERNAL: "Marché client",
  INTERNAL: "Travail interne Eurovia",
};

export const STATUS = {
  CREATED: "Créé",
  PLANNED: "Planifié",
  IN_PROGRESS: "En cours",
  WAITING_CHIEF: "En attente validation chef de chantier",
  WAITING_CLIENT: "En attente validation client",
  CLIENT_VALIDATED: "Validé client",
  RESERVE: "Mise en réserve",
  CORRECTION: "Intervention corrective",
  TO_INVOICE: "À facturer",
  INVOICED: "Facturé",
  PAID: "Payé",
  CLOSED: "Clôturé",
  DONE: "Terminé",
};

export const INITIAL_OS = [
  {
    id: "os-142", number: "OS-2026-0142", type: DOSSIER_TYPES.EXTERNAL,
    client: "Eau de Toulouse", market: "Marché voirie 2026", address: "18 rue des Lilas, Toulouse",
    sector: "Nord", material: "Enrobé noir", color: "Noir", plannedSurface: 85, actualSurface: null,
    status: STATUS.PLANNED, dueDate: "2026-10-22", plannedDay: "Lundi", team: "Équipe 2", vehicle: "BV01",
    creator: "Patrick", createdAt: "2026-10-17 09:14", traffic: "Faible",
    photos: { before: true, during: false, after: false },
    zones: [{ name: "Chaussée", planned: 85, actual: null, thickness: 6, overwidth: "Pleine largeur" }],
  },
  {
    id: "os-143", number: "OS-2026-0143", type: DOSSIER_TYPES.EXTERNAL,
    client: "Eau de Toulouse", market: "Marché voirie 2026", address: "7 avenue Jean Jaurès, Toulouse",
    sector: "Nord", material: "Enrobé noir", color: "Noir", plannedSurface: 72, actualSurface: null,
    status: STATUS.CREATED, dueDate: "2026-10-24", plannedDay: null, team: null, vehicle: null,
    creator: "Patrick", createdAt: "2026-10-18 08:32", traffic: "Faible",
    photos: { before: false, during: false, after: false }, zones: [],
  },
  {
    id: "os-144", number: "OS-2026-0144", type: DOSSIER_TYPES.EXTERNAL,
    client: "Eau de Toulouse", market: "Marché voirie 2026", address: "42 boulevard Armand Duportal, Toulouse",
    sector: "Centre", material: "Enrobé rouge", color: "Rouge", plannedSurface: 60, actualSurface: null,
    status: STATUS.IN_PROGRESS, dueDate: "2026-10-21", plannedDay: "Mercredi", team: "Équipe 3", vehicle: "BV03",
    creator: "Patrick", createdAt: "2026-10-15 16:10", traffic: "Forte",
    photos: { before: true, during: true, after: false }, zones: [{ name: "Chaussée", planned: 60, actual: 54, thickness: 6, overwidth: "Demi-chaussée" }],
  },
  {
    id: "os-145", number: "OS-2026-0145", type: DOSSIER_TYPES.EXTERNAL,
    client: "Eau de Toulouse", market: "Marché voirie 2026", address: "3 chemin de Borderouge, Toulouse",
    sector: "Nord", material: "Béton balayé", color: null, plannedSurface: 45, actualSurface: 45,
    status: STATUS.IN_PROGRESS, dueDate: "2026-10-29", plannedDay: "Mardi", team: "Équipe 1", vehicle: "BV02",
    creator: "Patrick", createdAt: "2026-10-16 10:05", traffic: "Faible",
    photos: { before: true, during: true, after: false }, zones: [{ name: "Trottoir", planned: 45, actual: 45, thickness: 12, overwidth: "Pleine largeur" }],
  },
  {
    id: "os-146", number: "OS-2026-0146", type: DOSSIER_TYPES.INTERNAL,
    client: "Eurovia", market: null, address: "11 rue de l'Est, Toulouse",
    sector: "Est", material: "Grave-émulsion", color: null, plannedSurface: 30, actualSurface: null,
    status: STATUS.CREATED, dueDate: "2026-11-02", plannedDay: null, team: null, vehicle: null,
    creator: "Patrick", createdAt: "2026-10-18 11:20", traffic: "Moyenne",
    photos: { before: false, during: false, after: false }, zones: [],
  },
];

export function nextOsNumber(list, year = new Date().getFullYear()) {
  const max = list.reduce((highest, os) => {
    const match = String(os.number).match(/-(\d{4})-(\d+)$/);
    return match && Number(match[1]) === year ? Math.max(highest, Number(match[2])) : highest;
  }, 0);
  return `OS-${year}-${String(max + 1).padStart(4, "0")}`;
}

export function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createOs(list, input = {}) {
  const createdAt = new Date();
  const createdDate = createdAt.toISOString().slice(0, 10);
  return {
    id: `os-${Date.now()}`,
    number: nextOsNumber(list),
    type: input.type || DOSSIER_TYPES.EXTERNAL,
    client: input.client || (input.type === DOSSIER_TYPES.INTERNAL ? "Eurovia" : "Eau de Toulouse"),
    market: input.type === DOSSIER_TYPES.INTERNAL ? null : (input.market || "Marché voirie 2026"),
    address: input.address || "Adresse à renseigner",
    sector: input.sector || "À définir",
    material: input.material || "Enrobé noir",
    color: input.color || (input.material === "Enrobé noir" ? "Noir" : null),
    plannedSurface: Number(input.plannedSurface || 0), actualSurface: null,
    status: STATUS.CREATED,
    dueDate: addDays(createdDate, 25), plannedDay: null, team: null, vehicle: null,
    creator: input.creator || "Utilisateur connecté", createdAt: createdAt.toISOString(), traffic: input.traffic || "À définir",
    photos: { before: false, during: false, after: false }, zones: [],
  };
}

const EXTERNAL_FLOW = {
  [STATUS.CREATED]: [STATUS.PLANNED, STATUS.WAITING_CHIEF],
  [STATUS.PLANNED]: [STATUS.IN_PROGRESS, STATUS.WAITING_CHIEF],
  [STATUS.IN_PROGRESS]: [STATUS.WAITING_CHIEF],
  [STATUS.WAITING_CHIEF]: [STATUS.IN_PROGRESS, STATUS.CLIENT_VALIDATED, STATUS.RESERVE],
  [STATUS.CLIENT_VALIDATED]: [STATUS.TO_INVOICE],
  [STATUS.TO_INVOICE]: [STATUS.INVOICED],
  [STATUS.INVOICED]: [STATUS.PAID],
  [STATUS.PAID]: [STATUS.CLOSED],
  [STATUS.RESERVE]: [STATUS.CORRECTION],
  [STATUS.CORRECTION]: [STATUS.WAITING_CHIEF],
};

const INTERNAL_FLOW = {
  [STATUS.CREATED]: [STATUS.PLANNED],
  [STATUS.PLANNED]: [STATUS.IN_PROGRESS],
  [STATUS.IN_PROGRESS]: [STATUS.DONE],
  [STATUS.DONE]: [STATUS.CLOSED],
};

export function allowedTransitions(os) {
  return (os.type === DOSSIER_TYPES.INTERNAL ? INTERNAL_FLOW : EXTERNAL_FLOW)[os.status] || [];
}

export function canTransition(os, nextStatus) {
  return allowedTransitions(os).includes(nextStatus);
}

export function hasMandatoryCompletionPhotos(os) {
  return Boolean(os.photos?.before && os.photos?.after);
}

export function canSubmitForChiefValidation(os) {
  return os.type === DOSSIER_TYPES.INTERNAL ? Boolean(os.photos?.after) : hasMandatoryCompletionPhotos(os);
}
