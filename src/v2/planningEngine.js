// SETOM V2 — deterministic planning engine
// Hard operational rules are enforced here; UI/AI must not bypass them.

export const PLANNING_RULES = Object.freeze({
  asphaltOneColorPerTour: true,
  priority: [
    'deadline',
    'same_material',
    'largest_surface',
    'peripheral_zone',
    'low_traffic',
    'geographic_grouping',
    'team_vehicle_optimization',
  ],
});

const norm = (value) => String(value ?? '').trim().toLowerCase();

export function materialKey(os) {
  return norm(os.material ?? os.materialType ?? os.workMaterial);
}

export function materialColor(os) {
  return norm(os.color ?? os.materialColor ?? '');
}

export function isAsphalt(os) {
  return ['enrobe', 'enrobé', 'asphalt'].some((x) => materialKey(os).includes(x));
}

export function canShareTour(a, b) {
  if (!a || !b) return true;
  if (materialKey(a) !== materialKey(b)) return false;
  if (PLANNING_RULES.asphaltOneColorPerTour && isAsphalt(a) && materialColor(a) !== materialColor(b)) return false;
  return true;
}

export function payloadTons(os) {
  return Number(os.estimatedTons ?? os.tonnage ?? os.tonnes ?? 0) || 0;
}

export function surfaceM2(os) {
  return Number(os.actualSurface ?? os.plannedSurface ?? os.surface ?? 0) || 0;
}

export function deadlineScore(os, today = new Date()) {
  if (!os.deadline) return 0;
  const days = Math.ceil((new Date(os.deadline) - today) / 86400000);
  if (days <= 0) return 10000;
  if (days <= 3) return 5000 - days * 100;
  if (days <= 10) return 2500 - days * 50;
  return Math.max(0, 1000 - days * 10);
}

export function planningScore(os, today = new Date()) {
  const urgency = deadlineScore(os, today);
  const surface = Math.min(surfaceM2(os), 1000);
  const peripheral = norm(os.zoneType ?? os.locationType).includes('peripher') ? 300 : 0;
  const traffic = norm(os.traffic ?? os.circulation);
  const lowTraffic = ['faible', 'low', 'faible circulation'].includes(traffic) ? 180 : 0;
  return urgency + surface * 2 + peripheral + lowTraffic;
}

export function validateTruckLoad({ items = [], maxPayloadTons = Infinity }) {
  const total = items.reduce((sum, item) => sum + payloadTons(item), 0);
  const materials = new Set(items.map(materialKey).filter(Boolean));
  const colors = new Set(items.filter(isAsphalt).map(materialColor).filter(Boolean));
  return {
    valid: total <= maxPayloadTons && materials.size <= 1 && colors.size <= 1,
    totalTons: total,
    remainingTons: Math.max(0, maxPayloadTons - total),
    reasons: [
      ...(total > maxPayloadTons ? ['Capacité camion dépassée'] : []),
      ...(materials.size > 1 ? ['Plusieurs matériaux sur une même tournée'] : []),
      ...(colors.size > 1 ? ['Plusieurs couleurs d’enrobé sur une même tournée'] : []),
    ],
  };
}

export function rankForPlanning(osList, today = new Date()) {
  return [...osList].sort((a, b) => planningScore(b, today) - planningScore(a, today));
}

export function buildTour(osList, { maxPayloadTons = Infinity, forceTwoMaterials = false } = {}) {
  const ranked = rankForPlanning(osList);
  const tour = [];
  for (const os of ranked) {
    if (tour.length === 0) {
      tour.push(os);
      continue;
    }
    const compatible = forceTwoMaterials || canShareTour(tour[0], os);
    const payload = validateTruckLoad({ items: [...tour, os], maxPayloadTons });
    if (compatible && payload.valid) tour.push(os);
  }
  return {
    items: tour,
    load: validateTruckLoad({ items: tour, maxPayloadTons }),
    forced: Boolean(forceTwoMaterials),
  };
}
