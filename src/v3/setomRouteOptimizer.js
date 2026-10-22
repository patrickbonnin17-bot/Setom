const DEFAULT_CAPACITY_T = 8;

const BLOCKED_STATUSES = new Set(["Archivé", "Payé", "Réserve", "En erreur", "En attente"]);

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const getAreaM2 = (workOrder, intervention = null) =>
  Math.max(0, toNumber(intervention?.planned_surface_m2 ?? workOrder?.planned_surface_m2 ?? workOrder?.planned_road_surface_m2));

export const getDensity = (material) => {
  const configured = toNumber(material?.density_t_m3);
  if (configured > 0) return configured;
  return 0;
};

export const getThicknessCm = (material) => {
  const configured = toNumber(material?.default_thickness_cm);
  return configured > 0 ? configured : 0;
};

export const estimateTonnage = (workOrder, material, intervention = null) => {
  const area = getAreaM2(workOrder, intervention);
  const thickness = getThicknessCm(material);
  const density = getDensity(material);
  if (!area || !thickness || !density) return null;
  return area * (thickness / 100) * density;
};

export const daysUntil = (date, today = new Date()) => {
  if (!date) return null;
  const target = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  const base = new Date(`${today.toISOString().slice(0, 10)}T12:00:00`);
  return Math.ceil((target - base) / 86400000);
};

export const haversineKm = (a, b) => {
  const lat1 = toNumber(a?.latitude, NaN);
  const lon1 = toNumber(a?.longitude, NaN);
  const lat2 = toNumber(b?.latitude, NaN);
  const lon2 = toNumber(b?.longitude, NaN);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const r = 6371;
  const p = Math.PI / 180;
  const dLat = (lat2 - lat1) * p;
  const dLon = (lon2 - lon1) * p;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
};

const eligible = (workOrder) =>
  workOrder && !workOrder.problem_suspended && !BLOCKED_STATUSES.has(workOrder.status);

const urgencyScore = (workOrder, today) => {
  const days = daysUntil(workOrder?.deadline_date, today);
  if (days === null) return 0;
  if (days <= 0) return 100;
  if (days <= 2) return 80;
  if (days <= 5) return 55;
  if (days <= 10) return 30;
  return 10;
};

const routeDistance = (items) => {
  let km = 0;
  for (let i = 1; i < items.length; i += 1) {
    km += haversineKm(items[i - 1].workOrder, items[i].workOrder) || 0;
  }
  return km;
};

const nearestNeighbour = (items) => {
  if (items.length < 2) return [...items];
  const remaining = [...items];
  remaining.sort((a, b) => urgencyScore(b.workOrder) - urgencyScore(a.workOrder));
  const ordered = [remaining.shift()];
  while (remaining.length) {
    const current = ordered[ordered.length - 1];
    remaining.sort((a, b) => {
      const da = haversineKm(current.workOrder, a.workOrder);
      const db = haversineKm(current.workOrder, b.workOrder);
      return (da ?? Number.POSITIVE_INFINITY) - (db ?? Number.POSITIVE_INFINITY);
    });
    ordered.push(remaining.shift());
  }
  return ordered;
};

const materialRotations = (items, capacity) => {
  const groups = new Map();
  for (const item of items) {
    const key = item.workOrder.material_id || "unknown";
    groups.set(key, (groups.get(key) || 0) + (item.tonnage || 0));
  }
  return [...groups.entries()].map(([materialId, tonnes]) => ({
    materialId,
    tonnes,
    rotations: tonnes > 0 ? Math.ceil(tonnes / capacity) : 0,
    fillRate: tonnes > 0 ? Math.min(1, tonnes / (Math.ceil(tonnes / capacity) * capacity)) : 0,
  }));
};

/**
 * Deterministic SETOM planning engine.
 * It never writes to Supabase. It only proposes a plan that the UI can show
 * and that the user can validate before any persistence is attempted.
 */
export function buildRouteProposal({
  workOrders = [],
  interventions = [],
  teams = [],
  trucks = [],
  materials = [],
  teamCount = 2,
  capacityT = DEFAULT_CAPACITY_T,
  today = new Date(),
} = {}) {
  const activeTeams = teams.filter((team) => team?.active !== false).slice(0, Math.max(1, teamCount));
  const truckByTeam = new Map(trucks.filter((truck) => truck?.active !== false).map((truck) => [truck.team_id, truck]));
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const interventionByOrder = new Map(interventions.map((intervention) => [intervention.work_order_id, intervention]));

  const candidates = workOrders
    .filter(eligible)
    .filter((order) => !interventionByOrder.has(order.id))
    .map((workOrder) => {
      const intervention = interventionByOrder.get(workOrder.id);
      const material = materialById.get(workOrder.material_id);
      const tonnage = estimateTonnage(workOrder, material, intervention);
      return {
        workOrder,
        intervention,
        material,
        tonnage,
        urgency: urgencyScore(workOrder, today),
        daysLeft: daysUntil(workOrder.deadline_date, today),
      };
    });

  const missingData = candidates.filter((item) => item.tonnage === null || !item.material);
  const sorted = [...candidates].sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    const materialA = a.workOrder.material_id || "";
    const materialB = b.workOrder.material_id || "";
    if (materialA !== materialB) return materialA.localeCompare(materialB);
    return (a.workOrder.sector_id || "").localeCompare(b.workOrder.sector_id || "");
  });

  const buckets = activeTeams.map((team) => ({
    team,
    truck: truckByTeam.get(team.id) || null,
    items: [],
    tonnage: 0,
  }));

  for (const item of sorted) {
    const usable = buckets.filter((bucket) => bucket.truck);
    if (!usable.length) break;
    const scored = usable.map((bucket) => {
      const last = bucket.items[bucket.items.length - 1];
      const distancePenalty = last ? (haversineKm(last.workOrder, item.workOrder) || 8) : 0;
      const sameMaterialBonus = last?.workOrder?.material_id === item.workOrder.material_id ? 12 : 0;
      const loadPenalty = bucket.tonnage / Math.max(1, toNumber(bucket.truck?.capacity_t, capacityT));
      return { bucket, score: bucket.tonnage * 0.8 + distancePenalty * 1.4 + loadPenalty * 6 - sameMaterialBonus - item.urgency * 0.25 };
    });
    scored.sort((a, b) => a.score - b.score);
    scored[0].bucket.items.push(item);
    scored[0].bucket.tonnage += item.tonnage || 0;
  }

  const routes = buckets.map((bucket) => {
    const ordered = nearestNeighbour(bucket.items);
    const capacity = Math.max(0.1, toNumber(bucket.truck?.capacity_t, capacityT));
    const rotations = materialRotations(ordered, capacity);
    const totalRotations = rotations.reduce((sum, row) => sum + row.rotations, 0);
    const km = routeDistance(ordered);
    const averageFill = totalRotations ? ordered.reduce((sum, item) => sum + (item.tonnage || 0), 0) / (totalRotations * capacity) : 0;
    const urgent = ordered.filter((item) => item.daysLeft !== null && item.daysLeft <= 3).length;
    return {
      team: bucket.team,
      truck: bucket.truck,
      stops: ordered,
      tonnage: bucket.tonnage,
      rotations,
      totalRotations,
      km,
      averageFill,
      urgent,
    };
  });

  const unassigned = candidates.filter((candidate) => !routes.some((route) => route.stops.some((stop) => stop.workOrder.id === candidate.workOrder.id)));
  const totalTonnage = routes.reduce((sum, route) => sum + route.tonnage, 0);
  const totalRotations = routes.reduce((sum, route) => sum + route.totalRotations, 0);
  const totalKm = routes.reduce((sum, route) => sum + route.km, 0);
  const capacity = Math.max(0.1, capacityT);

  return {
    date: today.toISOString().slice(0, 10),
    routes,
    unassigned,
    missingData,
    totals: {
      os: candidates.length,
      assigned: candidates.length - unassigned.length,
      tonnage: totalTonnage,
      rotations: totalRotations,
      km: totalKm,
      averageFill: totalRotations ? totalTonnage / (totalRotations * capacity) : 0,
    },
    warnings: [
      ...activeTeams.filter((team) => !truckByTeam.has(team.id)).map((team) => `${team.name} n'a pas de camion actif affecté.`),
      ...missingData.map((item) => `${item.workOrder.os_number || item.workOrder.id}: tonnage impossible à calculer (matériau, épaisseur ou densité manquante).`),
      ...routes.filter((route) => route.urgent > 0).map((route) => `${route.team.name}: ${route.urgent} OS urgent(s) dans les 3 jours.`),
    ],
  };
}

export default buildRouteProposal;
