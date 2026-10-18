import React, { useEffect, useMemo, useState } from "react";

const KEY = "setom:travaux:timers:v1";
const EVENT = "setom:travaux-timer";
const LOAD_KEY = "setom:chargement:v3";
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

function readAll() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }
function writeAll(value) { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* storage unavailable */ } }
function getTimer(orderId) { return orderId ? readAll()[orderId] || null : null; }
function readJson(keys) { for (const key of keys) { try { const value = JSON.parse(localStorage.getItem(key) || "null"); if (value && typeof value === "object") return value; } catch (_) {} } return {}; }
function readLoadingRows(orderId) {
  if (!orderId) return [];
  try {
    const all = JSON.parse(localStorage.getItem(LOAD_KEY) || "{}");
    const rows = Object.values(all || {}).flatMap((day) => Array.isArray(day?.rows) ? day.rows : []);
    return rows.filter((row) => String(row?.orderId || row?.osId || row?.id || "") === String(orderId));
  } catch (_) { return []; }
}
function contextFor(orderId) {
  const sources = [readJson(["setom:chargement:order:v1"]), readJson(["setom:planning:selected-order:v1"])];
  const value = sources.find((item) => { const id = item?.orderId || item?.id || item?.dbId || item?.osId; return !orderId || !id || String(id) === String(orderId); }) || {};
  const loading = readLoadingRows(orderId); const firstLoad = loading[0] || {};
  return {
    orderId: orderId || value.orderId || value.id || value.dbId || value.osId || firstLoad.orderId || firstLoad.osId || null,
    osNumber: value.osNumber || value.number || value.os || firstLoad.osNumber || null,
    workType: value.workType || value.type || value.nature || value.material || firstLoad.material || "Autre",
    surfaceM2: num(value.surfaceM2 ?? value.surface ?? value.actualSurfaceM2 ?? value.plannedSurfaceM2),
    quantityT: num(value.quantityT ?? value.tonnage ?? value.plannedTonnage ?? value.planned ?? firstLoad.planned ?? firstLoad.quantityT ?? firstLoad.tonnage),
    thicknessCm: num(value.thicknessCm ?? value.thickness ?? firstLoad.thicknessCm),
    crewCount: Math.max(0, Math.round(num(value.crewCount ?? value.teamSize ?? value.effectif ?? firstLoad.crewCount))),
    trafficLevel: value.trafficLevel || value.traffic || "normal",
    accessLevel: value.accessLevel || value.access || "normal",
  };
}
function emit(orderId) { window.dispatchEvent(new CustomEvent(EVENT, { detail: { orderId, timer: getTimer(orderId) } })); }
function start(orderId) { if (!orderId) return null; const all = readAll(); const current = all[orderId]; if (current?.startedAt && !current.completedAt) return current; const timer = { orderId, startedAt: new Date().toISOString(), pausedAt: null, waitingSeconds: 0, completedAt: null, source: "device-clock" }; all[orderId] = timer; writeAll(all); emit(orderId); return timer; }
function pause(orderId) { const all = readAll(); const current = all[orderId]; if (!current?.startedAt || current.completedAt || current.pausedAt) return current || null; current.pausedAt = new Date().toISOString(); all[orderId] = current; writeAll(all); emit(orderId); return current; }
function resume(orderId) { const all = readAll(); const current = all[orderId]; if (!current?.startedAt || current.completedAt || !current.pausedAt) return current || null; const pauseAt = new Date(current.pausedAt).getTime(); current.waitingSeconds = Math.max(0, Number(current.waitingSeconds || 0) + Math.max(0, (Date.now() - pauseAt) / 1000)); current.pausedAt = null; all[orderId] = current; writeAll(all); emit(orderId); return current; }
function finish(orderId) {
  const all = readAll(); const current = all[orderId]; if (!current?.startedAt || current.completedAt) return current || null;
  if (current.pausedAt) resume(orderId);
  const latest = readAll()[orderId]; latest.completedAt = new Date().toISOString(); all[orderId] = latest; writeAll(all); emit(orderId);
  const context = contextFor(orderId);
  const observation = { ...context, orderId, startedAt: latest.startedAt, completedAt: latest.completedAt, actualHours: productiveHours(latest), waitingHours: Number(latest.waitingSeconds || 0) / 3600, source: "travaux-timer", date: latest.startedAt.slice(0, 10) };
  window.dispatchEvent(new CustomEvent("setom:productivity-observation", { detail: observation }));
  try { window.setomStaffingIntelligence?.recordProductivityObservation(observation); } catch (_) { /* optional learning layer */ }
  return latest;
}
function productiveHours(timer) { if (!timer?.startedAt) return 0; const end = timer.completedAt ? new Date(timer.completedAt).getTime() : Date.now(); const startMs = new Date(timer.startedAt).getTime(); const waiting = Number(timer.waitingSeconds || 0) * 1000 + (timer.pausedAt ? Math.max(0, end - new Date(timer.pausedAt).getTime()) : 0); return Math.max(0, (end - startMs - waiting) / 3600000); }
function formatDuration(hours) { const totalMinutes = Math.max(0, Math.round(hours * 60)); const h = Math.floor(totalMinutes / 60); const m = totalMinutes % 60; return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`; }

export function TravauxTimeTracking({ orderId, status }) {
  const [timer, setTimer] = useState(() => getTimer(orderId)); const [, setTick] = useState(0);
  useEffect(() => { setTimer(getTimer(orderId)); const onTimer = (event) => { if (event.detail?.orderId === orderId) setTimer(event.detail.timer); }; window.addEventListener(EVENT, onTimer); const interval = window.setInterval(() => setTick((value) => value + 1), 1000); return () => { window.removeEventListener(EVENT, onTimer); window.clearInterval(interval); }; }, [orderId]);
  const active = !!timer?.startedAt && !timer?.completedAt; const elapsed = useMemo(() => productiveHours(timer), [timer, timer?.pausedAt, timer?.completedAt]); const waiting = Number(timer?.waitingSeconds || 0) / 3600 + (timer?.pausedAt ? Math.max(0, (Date.now() - new Date(timer.pausedAt).getTime()) / 3600000) : 0);
  if (!orderId) return null;
  const canStart = ["Planifié", "En travaux", "Travaux en cours"].includes(status);
  const button = (label, className, onClick) => React.createElement("button", { type: "button", className, onClick }, label);
  const children = [
    React.createElement("div", { key: "head", style: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" } }, React.createElement("div", null, React.createElement("strong", null, "⏱️ Temps d’intervention"), React.createElement("div", { style: { marginTop: 4, color: "#667085", fontSize: 13 } }, active ? (timer.pausedAt ? "Intervention en attente" : "Intervention en cours") : timer?.completedAt ? "Intervention terminée" : "Chronométrage prêt")), React.createElement("div", { style: { fontSize: 24, fontWeight: 800 } }, formatDuration(elapsed))),
    React.createElement("div", { key: "actions", style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 } }, !active && !timer?.completedAt && canStart ? button("▶ Démarrer l’OS", "primary", () => setTimer(start(orderId))) : null, active && !timer.pausedAt ? button("⏸ Mettre en attente", "secondary", () => setTimer(pause(orderId))) : null, active && timer.pausedAt ? button("▶ Reprendre", "secondary", () => setTimer(resume(orderId))) : null, active ? button("⏹ Terminer l’OS", "primary", () => setTimer(finish(orderId))) : null),
    React.createElement("div", { key: "meta", style: { display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, color: "#667085", fontSize: 12 } }, timer?.startedAt ? React.createElement("span", null, "Début : ", new Date(timer.startedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })) : null, React.createElement("span", null, "Temps productif : ", React.createElement("strong", null, formatDuration(elapsed))), React.createElement("span", null, "Attente : ", React.createElement("strong", null, formatDuration(waiting))))
  ];
  return React.createElement("div", { className: "setom-travaux-timer", style: { margin: "16px 0", padding: 16, border: "1px solid #dbe3ef", borderRadius: 14, background: "#f8fafc" } }, children);
}
export function installTravauxTimeTracking() { window.setomTravauxTimer = { start, pause, resume, finish, get: getTimer }; }
installTravauxTimeTracking();
