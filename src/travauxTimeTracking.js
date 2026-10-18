import React, { useEffect, useMemo, useState } from "react";

const KEY = "setom:travaux:timers:v1";
const EVENT = "setom:travaux-timer";

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function writeAll(value) {
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
function getTimer(orderId) { return orderId ? readAll()[orderId] || null : null; }
function emit(orderId) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { orderId, timer: getTimer(orderId) } }));
}
function start(orderId) {
  if (!orderId) return null;
  const all = readAll();
  const current = all[orderId];
  if (current?.startedAt && !current.completedAt) return current;
  const now = new Date().toISOString();
  const timer = { orderId, startedAt: now, pausedAt: null, waitingSeconds: 0, completedAt: null, source: "device-clock" };
  all[orderId] = timer; writeAll(all); emit(orderId); return timer;
}
function pause(orderId) {
  const all = readAll(); const current = all[orderId];
  if (!current?.startedAt || current.completedAt || current.pausedAt) return current || null;
  current.pausedAt = new Date().toISOString(); all[orderId] = current; writeAll(all); emit(orderId); return current;
}
function resume(orderId) {
  const all = readAll(); const current = all[orderId];
  if (!current?.startedAt || current.completedAt || !current.pausedAt) return current || null;
  const pauseAt = new Date(current.pausedAt).getTime();
  const now = Date.now();
  current.waitingSeconds = Math.max(0, Number(current.waitingSeconds || 0) + Math.max(0, (now - pauseAt) / 1000));
  current.pausedAt = null; all[orderId] = current; writeAll(all); emit(orderId); return current;
}
function finish(orderId) {
  const all = readAll(); const current = all[orderId];
  if (!current?.startedAt || current.completedAt) return current || null;
  if (current.pausedAt) resume(orderId);
  const latest = readAll()[orderId];
  latest.completedAt = new Date().toISOString();
  all[orderId] = latest; writeAll(all); emit(orderId);
  window.dispatchEvent(new CustomEvent("setom:productivity-observation", { detail: {
    orderId,
    startedAt: latest.startedAt,
    completedAt: latest.completedAt,
    actualHours: productiveHours(latest),
    waitingHours: Number(latest.waitingSeconds || 0) / 3600,
    source: "travaux-timer"
  }}));
  return latest;
}
function productiveHours(timer) {
  if (!timer?.startedAt) return 0;
  const end = timer.completedAt ? new Date(timer.completedAt).getTime() : Date.now();
  const startMs = new Date(timer.startedAt).getTime();
  const waiting = Number(timer.waitingSeconds || 0) * 1000 + (timer.pausedAt ? Math.max(0, end - new Date(timer.pausedAt).getTime()) : 0);
  return Math.max(0, (end - startMs - waiting) / 3600000);
}
function formatDuration(hours) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60); const m = totalMinutes % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export function TravauxTimeTracking({ orderId, status }) {
  const [timer, setTimer] = useState(() => getTimer(orderId));
  const [, setTick] = useState(0);
  useEffect(() => {
    setTimer(getTimer(orderId));
    const onTimer = (event) => { if (event.detail?.orderId === orderId) setTimer(event.detail.timer); };
    window.addEventListener(EVENT, onTimer);
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => { window.removeEventListener(EVENT, onTimer); window.clearInterval(interval); };
  }, [orderId]);

  const active = !!timer?.startedAt && !timer?.completedAt;
  const elapsed = useMemo(() => productiveHours(timer), [timer, timer?.pausedAt, timer?.completedAt]);
  const waiting = Number(timer?.waitingSeconds || 0) / 3600 + (timer?.pausedAt ? Math.max(0, (Date.now() - new Date(timer.pausedAt).getTime()) / 3600000) : 0);

  if (!orderId) return null;
  const canStart = ["Planifié", "Travaux en cours", "Travaux réalisés"].includes(status);
  return <div className="setom-travaux-timer" style={{ margin: "16px 0", padding: 16, border: "1px solid #dbe3ef", borderRadius: 14, background: "#f8fafc" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <strong>⏱️ Temps d’intervention</strong>
        <div style={{ marginTop: 4, color: "#667085", fontSize: 13 }}>
          {active ? (timer.pausedAt ? "Intervention en attente" : "Intervention en cours") : timer?.completedAt ? "Intervention terminée" : "Chronométrage prêt"}
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{formatDuration(elapsed)}</div>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {!active && !timer?.completedAt && canStart && <button type="button" className="primary" onClick={() => setTimer(start(orderId))}>▶ Démarrer l’OS</button>}
      {active && !timer.pausedAt && <button type="button" className="secondary" onClick={() => setTimer(pause(orderId))}>⏸ Mettre en attente</button>}
      {active && timer.pausedAt && <button type="button" className="secondary" onClick={() => setTimer(resume(orderId))}>▶ Reprendre</button>}
      {active && <button type="button" className="primary" onClick={() => setTimer(finish(orderId))}>⏹ Terminer l’OS</button>}
    </div>
    <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, color: "#667085", fontSize: 12 }}>
      {timer?.startedAt && <span>Début : {new Date(timer.startedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
      <span>Temps productif : <strong>{formatDuration(elapsed)}</strong></span>
      <span>Attente : <strong>{formatDuration(waiting)}</strong></span>
    </div>
  </div>;
}

export function installTravauxTimeTracking() {
  window.setomTravauxTimer = { start, pause, resume, finish, get: getTimer };
}

installTravauxTimeTracking();
