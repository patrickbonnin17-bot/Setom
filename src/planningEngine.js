const DEFAULT_BASELINE_M2 = 30;
const REFERENCE_TEAM_SIZE = 6;
const LARGE_PIECE_THRESHOLD_M2 = 6;
const DEFAULT_WORK_START_HOUR = 9;

const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase("fr-FR");

export function materialKey(order) {
  return normalize(order?.material_detail || order?.material_name || order?.material);
}

export function isLargePiece(order) {
  return Number(order?.planned_surface_m2 || 0) > LARGE_PIECE_THRESHOLD_M2;
}

export function isHighTraffic(order) {
  return order?.is_night === true
    || order?.is_high_traffic === true
    || ["forte", "élevée", "elevee", "high"].includes(normalize(order?.traffic_level));
}

export function isCityOrder(order) {
  const city = normalize(order?.city);
  const address = normalize(order?.address);
  return order?.in_city === true || city === "toulouse" || address.includes("toulouse");
}

export function teamCapacityM2(team, fallback = DEFAULT_BASELINE_M2) {
  const explicit = Number(team?.indicative_capacity);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const size = Number(team?.team_size ?? team?.headcount ?? team?.members_count);
  if (Number.isFinite(size) && size > 0) return fallback * (size / REFERENCE_TEAM_SIZE);

  return fallback;
}

export function effectiveCapacityM2(order, team, material, options = {}) {
  const baseline = Number(options.baselineDailyCapacityM2) > 0
    ? Number(options.baselineDailyCapacityM2)
    : DEFAULT_BASELINE_M2;
  const teamCapacity = teamCapacityM2(team, baseline);
  const materialCapacity = Number(material?.indicative_capacity_m2);
  const difficulty = Number(material?.planning_difficulty) > 0 ? Number(material.planning_difficulty) : 1;
  const capped = Number.isFinite(materialCapacity) && materialCapacity > 0
    ? Math.min(teamCapacity, materialCapacity)
    : teamCapacity;
  return capped / difficulty;
}

function weekday(date) {
  return new Date(`${date}T12:00:00`).getDay();
}

function addDays(date, count) {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function candidateDays(startDate, horizonDays) {
  const start = new Date(`${startDate}T12:00:00`);
  const days = [];
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = iso(addDays(start, offset));
    const day = weekday(date);
    if (day !== 0 && day !== 6) days.push(date);
  }
  return days;
}

function materialForOrder(order, materials) {
  const key = materialKey(order);
  if (!key) return null;
  return materials.find((material) => normalize(material.name) === key)
    || materials.find((material) => normalize(material.category) === key)
    || null;
}

function sortQueue(orders) {
  return [...orders].sort((a, b) => {
    const deadline = String(a.deadline_date || "9999-12-31").localeCompare(String(b.deadline_date || "9999-12-31"));
    if (deadline !== 0) return deadline;
    const traffic = Number(isHighTraffic(b)) - Number(isHighTraffic(a));
    if (traffic !== 0) return traffic;
    const large = Number(isLargePiece(b)) - Number(isLargePiece(a));
    if (large !== 0) return large;
    const sector = String(a.sector_name || "").localeCompare(String(b.sector_name || ""), "fr");
    if (sector !== 0) return sector;
    return Number(a.os_number || 0) - Number(b.os_number || 0);
  });
}

function dayLoadKey(date, teamId) {
  return `${date}|${teamId}`;
}

function addMaterialForDay(materialByDay, date, material) {
  if (!material) return;
  if (!materialByDay.has(date)) materialByDay.set(date, new Set());
  materialByDay.get(date).add(material);
}

function hasMaterialConflict(materialByDay, date, material) {
  if (!material) return false;
  const existing = materialByDay.get(date);
  if (!existing || existing.size === 0) return false;
  return existing.size !== 1 || !existing.has(material);
}

function cityMorningConflict(order) {
  return isCityOrder(order) || isHighTraffic(order);
}

function isTeamBlocked(blockedTeamDates, date, teamId) {
  return Boolean(blockedTeamDates?.has?.(dayLoadKey(date, teamId)));
}

export function buildPlanningAssignments({
  orders = [],
  teams = [],
  materials = [],
  startDate,
  horizonDays = 120,
  baselineDailyCapacityM2 = DEFAULT_BASELINE_M2,
  marginPercent = 0,
  blockedTeamDates = new Set(),
}) {
  const queue = sortQueue(orders);
  const activeTeams = teams.filter((team) => team?.active !== false);
  const days = candidateDays(startDate, horizonDays);
  const loads = new Map();
  const materialByDay = new Map();
  const dayOrders = new Map();
  const assignments = [];
  const warnings = [];

  for (const order of orders) {
    if (!order?.planned_date || !order?.team_id) continue;
    const key = dayLoadKey(order.planned_date, order.team_id);
    const material = materialForOrder(order, materials);
    const team = activeTeams.find((item) => item.id === order.team_id);
    const capacity = effectiveCapacityM2(order, team, material, { baselineDailyCapacityM2 });
    const planned = Math.max(0, Number(order.planned_surface_m2 || 0));
    const withMargin = planned * (1 + Math.max(0, Number(marginPercent || 0)) / 100);
    loads.set(key, Number(loads.get(key) || 0) + (capacity > 0 ? withMargin / capacity : 1));
    dayOrders.set(order.planned_date, Math.max(Number(dayOrders.get(order.planned_date) || 0), Number(order.planned_order || 0)));
    addMaterialForDay(materialByDay, order.planned_date, materialKey(order));
  }

  for (const order of queue) {
    const material = materialForOrder(order, materials);
    const materialName = materialKey(order);
    let selected = null;

    for (const date of days) {
      if (order.deadline_date && date > order.deadline_date) warnings.push({ type: "late", workOrderId: order.id, date });
      if (hasMaterialConflict(materialByDay, date, materialName)) continue;

      let teamPool = activeTeams;
      if (order.sector_id) {
        const sectorTeams = activeTeams.filter((team) => !team.usual_sector_id || team.usual_sector_id === order.sector_id);
        if (sectorTeams.length) teamPool = sectorTeams;
      }

      const surface = Math.max(0, Number(order.planned_surface_m2 || 0));
      const required = surface * (1 + Math.max(0, Number(marginPercent || 0)) / 100);
      const choices = teamPool.map((team) => {
        const capacity = effectiveCapacityM2(order, team, material, { baselineDailyCapacityM2 });
        const effort = capacity > 0 ? required / capacity : 1;
        const key = dayLoadKey(date, team.id);
        const used = Number(loads.get(key) || 0);
        const blocked = isTeamBlocked(blockedTeamDates, date, team.id);
        const fits = !blocked && effort <= 1 && used + effort <= 1;
        return { team, key, capacity, effort, used, fits, blocked };
      }).filter((choice) => choice.fits);

      if (!choices.length) continue;

      choices.sort((a, b) => {
        const sameSector = Number(Boolean(order.sector_id && a.team.usual_sector_id === order.sector_id));
        const sameSectorB = Number(Boolean(order.sector_id && b.team.usual_sector_id === order.sector_id));
        if (sameSector !== sameSectorB) return sameSectorB - sameSector;
        return a.used - b.used || String(a.team.name || "").localeCompare(String(b.team.name || ""), "fr");
      });

      const choice = choices[0];
      const position = Number(dayOrders.get(date) || 0) + 1;
      selected = {
        work_order_id: order.id,
        intervention_id: order.interventionId || null,
        planned_date: date,
        team_id: choice.team.id,
        planned_order: position,
      };
      assignments.push(selected);
      loads.set(choice.key, choice.used + choice.effort);
      dayOrders.set(date, position);
      addMaterialForDay(materialByDay, date, materialName);
      break;
    }

    if (!selected) {
      throw new Error(`Impossible de trouver une place pour ${order.os_number ?? order.id}. Vérifiez les capacités, les tâches libres, les matériaux ou les règles de planification.`);
    }
  }

  const byDay = new Map();
  for (const assignment of assignments) {
    if (!byDay.has(assignment.planned_date)) byDay.set(assignment.planned_date, []);
    byDay.get(assignment.planned_date).push(assignment);
  }

  for (const [, list] of byDay) {
    list.sort((a, b) => {
      const oa = orders.find((order) => order.id === a.work_order_id);
      const ob = orders.find((order) => order.id === b.work_order_id);
      const morningA = Number(isLargePiece(oa) && !cityMorningConflict(oa));
      const morningB = Number(isLargePiece(ob) && !cityMorningConflict(ob));
      if (morningA !== morningB) return morningB - morningA;
      const lateTrafficA = Number(isHighTraffic(oa));
      const lateTrafficB = Number(isHighTraffic(ob));
      if (lateTrafficA !== lateTrafficB) return lateTrafficA - lateTrafficB;
      return Number(a.planned_order || 0) - Number(b.planned_order || 0);
    });
    list.forEach((assignment, index) => { assignment.planned_order = index + 1; });
  }

  return { assignments, warnings };
}

export function explainPlanningRules() {
  return {
    baselineDailyCapacityM2: DEFAULT_BASELINE_M2,
    referenceTeamSize: REFERENCE_TEAM_SIZE,
    largePieceThresholdM2: LARGE_PIECE_THRESHOLD_M2,
    workStartHour: DEFAULT_WORK_START_HOUR,
    materialMixing: "one_material_per_day",
    deadlinePriority: "deadline_then_operational_constraints",
    blockedTeamDates: true,
    trafficPriority: "after_morning_rush",
  };
}
