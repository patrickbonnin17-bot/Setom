import { supabase } from "./supabase";

const BUILD = "2026-10-16-daily-time-summary";
const PAUSE_MINUTES = 60;

function minutesFromTime(value) {
  if (!value) return null;
  const parts = String(value).slice(0, 5).split(":").map(Number);
  if (parts.length < 2 || !parts.every(Number.isFinite)) return null;
  return parts[0] * 60 + parts[1];
}

function duration(arrival, departure) {
  const a = minutesFromTime(arrival);
  const d = minutesFromTime(departure);
  if (a == null || d == null) return null;
  return d >= a ? d - a : d + 1440 - a;
}

function formatMinutes(value) {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.max(0, Math.round(value));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

function extractDisplayedOSNumbers(container) {
  const text = container.innerText || "";
  const matches = [...text.matchAll(/(?:OS|os)-\d{4}-(\d{5})/g)];
  return [...new Set(matches.map((match) => Number(match[1])).filter(Number.isFinite))];
}

function findHost() {
  return document.querySelector(".setom-day-view") || document.querySelector(".setom-binder");
}

function render(host, groups) {
  host.querySelector(".setom-daily-time-summary")?.remove();
  const card = document.createElement("section");
  card.className = "setom-daily-time-summary";
  card.style.cssText = "margin:16px 0;padding:16px;border:1px solid #d9e0e7;border-radius:14px;background:#f8fafc;box-shadow:0 2px 8px rgba(16,24,40,.05)";
  const title = document.createElement("div");
  title.innerHTML = "<strong>⏱️ Résumé du temps de la journée</strong><div style=\"font-size:12px;color:#667085;margin-top:4px\">Le temps trajet est calculé par déduction : amplitude − 1 h de pause − temps passé sur les OS.</div>";
  card.appendChild(title);

  if (!groups.length) {
    const empty = document.createElement("div");
    empty.style.cssText = "margin-top:10px;color:#667085;font-size:13px";
    empty.textContent = "Renseignez les heures d’arrivée et de départ des OS pour obtenir le calcul.";
    card.appendChild(empty);
  } else {
    const grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px";
    groups.forEach((group) => {
      const item = document.createElement("div");
      item.style.cssText = "padding:12px;border:1px solid #e4e7ec;border-radius:10px;background:#fff";
      item.innerHTML = `<strong>${group.teamName}</strong><div style=\"display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;margin-top:8px;font-size:13px\"><span>Amplitude</span><b>${formatMinutes(group.amplitude)}</b><span>Pause</span><b>${formatMinutes(PAUSE_MINUTES)}</b><span>Temps chantier</span><b>${formatMinutes(group.work)}</b><span style=\"color:#175cd3\">Temps trajet / non affecté</span><b style=\"color:#175cd3\">${formatMinutes(group.travel)}</b></div>`;
      grid.appendChild(item);
    });
    card.appendChild(grid);
  }

  const anchor = host.querySelector(":scope > .setom-day-title, :scope > .setom-binder-head");
  if (anchor) anchor.insertAdjacentElement("afterend", card);
  else host.insertBefore(card, host.firstChild);
}

let timer = null;
async function refresh() {
  const host = findHost();
  if (!host) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const numbers = extractDisplayedOSNumbers(host);
      if (!numbers.length) return;
      const { data: orders, error: orderError } = await supabase
        .from("work_orders")
        .select("id, os_number, creation_date")
        .in("os_number", numbers);
      if (orderError) throw orderError;
      const ids = (orders || []).map((row) => row.id);
      if (!ids.length) return;
      const { data: interventions, error: interventionError } = await supabase
        .from("interventions")
        .select("id, work_order_id, team_id, arrival_time, departure_time, planned_order")
        .in("work_order_id", ids);
      if (interventionError) throw interventionError;
      const teamIds = [...new Set((interventions || []).map((row) => row.team_id).filter(Boolean))];
      let teams = [];
      if (teamIds.length) {
        const result = await supabase.from("teams").select("id, name").in("id", teamIds);
        if (!result.error) teams = result.data || [];
      }
      const teamNames = new Map(teams.map((team) => [team.id, team.name]));
      const orderMap = new Map((orders || []).map((order) => [order.id, order]));
      const groupsMap = new Map();
      for (const intervention of interventions || []) {
        const work = duration(intervention.arrival_time, intervention.departure_time);
        const arrival = minutesFromTime(intervention.arrival_time);
        const departure = minutesFromTime(intervention.departure_time);
        if (work == null || arrival == null || departure == null) continue;
        const key = intervention.team_id || "sans-equipe";
        if (!groupsMap.has(key)) groupsMap.set(key, { teamName: teamNames.get(intervention.team_id) || "Équipe non affectée", rows: [] });
        groupsMap.get(key).rows.push({ ...intervention, work, arrival, departure, order: orderMap.get(intervention.work_order_id) });
      }
      const groups = [...groupsMap.values()].map((group) => {
        const first = Math.min(...group.rows.map((row) => row.arrival));
        const last = Math.max(...group.rows.map((row) => row.departure));
        const amplitude = Math.max(0, last - first);
        const work = group.rows.reduce((sum, row) => sum + row.work, 0);
        const travel = Math.max(0, amplitude - PAUSE_MINUTES - work);
        return { ...group, amplitude, work, travel };
      }).sort((a, b) => a.teamName.localeCompare(b.teamName, "fr"));
      render(host, groups);
    } catch (error) {
      console.warn("SETOM — résumé temps journée :", error);
    }
  }, 120);
}

const observer = new MutationObserver(refresh);
observer.observe(document.body, { childList: true, subtree: true });
refresh();
