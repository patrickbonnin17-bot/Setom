import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase";

const DAY_COLORS = ["#1976d2", "#2e8b57", "#f39c12", "#8e44ad", "#d32f2f", "#16a6a6", "#e83e8c"];
const STATUS_PLANIFIABLE = ["À planifier", "Planifié"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthLabel = (date) => date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const startOfWeek = (date) => { const d = new Date(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(12, 0, 0, 0); return d; };
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function Planner({ onClose }) {
  const [view, setView] = useState("mois");
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(iso(new Date()));
  const [orders, setOrders] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: rows, error: woError } = await supabase.from("work_orders").select("id, os_number, creation_date, address, city, material_detail, planned_surface_m2, status, deadline_date, is_night").in("status", STATUS_PLANIFIABLE).order("os_number", { ascending: true });
    if (woError) { setError(woError.message); setLoading(false); return; }
    const ids = (rows || []).map((r) => r.id);
    let interventions = [];
    if (ids.length) {
      const result = await supabase.from("interventions").select("id, work_order_id, team_id, planned_date, planned_order, status").in("work_order_id", ids);
      if (!result.error) interventions = result.data || [];
    }
    const teamIds = [...new Set(interventions.map((x) => x.team_id).filter(Boolean))];
    let teamRows = [];
    if (teamIds.length) {
      const result = await supabase.from("teams").select("id, name").in("id", teamIds);
      if (!result.error) teamRows = result.data || [];
    }
    const allTeams = await supabase.from("teams").select("id, name").order("name");
    if (!allTeams.error) teamRows = allTeams.data || teamRows;
    const byWO = new Map(interventions.map((x) => [x.work_order_id, x]));
    const byTeam = new Map(teamRows.map((x) => [x.id, x.name]));
    setTeams(teamRows);
    setOrders((rows || []).map((r) => {
      const i = byWO.get(r.id);
      return { ...r, interventionId: i?.id || null, planned_date: i?.planned_date || null, planned_order: i?.planned_order || 0, team_id: i?.team_id || null, team_name: byTeam.get(i?.team_id) || "Non affectée" };
    }));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const byDate = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => { if (o.planned_date) { if (!map.has(o.planned_date)) map.set(o.planned_date, []); map.get(o.planned_date).push(o); } });
    map.forEach((list) => list.sort((a, b) => (a.planned_order || 0) - (b.planned_order || 0) || a.os_number - b.os_number));
    return map;
  }, [orders]);

  async function planOrder(order, date, teamId = order.team_id) {
    setSavingId(order.id); setError("");
    try {
      let interventionId = order.interventionId;
      if (!interventionId) {
        const { data, error: insertError } = await supabase.from("interventions").insert({ work_order_id: order.id, type: order.material_detail || "Intervention", status: date ? "Planifié" : "À planifier", planned_date: date || null, planned_surface_m2: order.planned_surface_m2 || null, team_id: teamId || null }).select("id").single();
        if (insertError) throw insertError;
        interventionId = data.id;
      } else {
        const { error: updateError } = await supabase.from("interventions").update({ planned_date: date || null, status: date ? "Planifié" : "À planifier", team_id: teamId || null }).eq("id", interventionId);
        if (updateError) throw updateError;
      }
      const newStatus = date ? "Planifié" : "À planifier";
      const { error: statusError } = await supabase.from("work_orders").update({ status: newStatus }).eq("id", order.id);
      if (statusError) throw statusError;
      setOrders((current) => current.map((x) => x.id === order.id ? { ...x, interventionId, planned_date: date || null, team_id: teamId || null, team_name: teams.find((t) => t.id === teamId)?.name || "Non affectée", status: newStatus } : x));
    } catch (e) { setError(e?.message || "Impossible d'enregistrer le planning."); }
    finally { setSavingId(null); }
  }

  async function moveOrder(order, delta) {
    if (!order.planned_date) return;
    const next = iso(addDays(new Date(order.planned_date + "T12:00:00"), delta));
    await planOrder(order, next, order.team_id);
    setSelectedDate(next); setCursor(new Date(next + "T12:00:00"));
  }

  async function changeOrderTeam(order, teamId) { await planOrder(order, order.planned_date, teamId || null); }

  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [cursor]);
  const weekCells = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)), [cursor]);
  const selectedOrders = byDate.get(selectedDate) || [];

  function renderOrder(order) {
    return <div key={order.id} className="setom-plan-order">
      <strong>OS-{new Date(order.creation_date).getFullYear()}-{String(order.os_number).padStart(5, "0")}</strong>
      <span>{order.address}{order.city ? `, ${order.city}` : ""}</span>
      <small>{order.material_detail || "Intervention"} · {order.planned_surface_m2 ? `${order.planned_surface_m2} m²` : "surface non renseignée"}</small>
      <div className="setom-plan-order-actions">
        <button disabled={savingId === order.id} onClick={() => moveOrder(order, -1)}>←</button>
        <button disabled={savingId === order.id} onClick={() => moveOrder(order, 1)}>→</button>
        <select value={order.team_id || ""} onChange={(e) => changeOrderTeam(order, e.target.value || null)} disabled={savingId === order.id}>
          <option value="">Équipe</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
    </div>;
  }

  return <div className="setom-planner-overlay">
    <div className="setom-planner">
      <header className="setom-planner-header"><div><h2>📅 Planning SETOM</h2><p>Planning réel des OS à planifier et planifiés</p></div><button onClick={onClose}>✕</button></header>
      {error && <div className="setom-plan-error">⚠️ {error}</div>}
      <div className="setom-plan-toolbar">
        <div className="setom-plan-tabs">{[["mois","Mois"],["semaine","Semaine"],["jour","Jour"],["classeur","Classeur"]].map(([id,label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}</div>
        <div className="setom-plan-nav"><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1, 12))}>‹</button><strong>{view === "mois" ? monthLabel(cursor) : new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong><button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 12))}>›</button><button onClick={() => { const now = new Date(); setCursor(now); setSelectedDate(iso(now)); }}>Aujourd'hui</button></div>
      </div>
      {loading ? <div className="setom-plan-loading">Chargement du planning…</div> : <>
        {view === "mois" && <div className="setom-month-grid">{monthCells.map((date, i) => { const key = iso(date); const items = byDate.get(key) || []; const inMonth = date.getMonth() === cursor.getMonth(); return <button key={key} className={`setom-month-cell ${inMonth ? "" : "muted"} ${key === selectedDate ? "selected" : ""}`} onClick={() => { setSelectedDate(key); setCursor(new Date(date.getFullYear(), date.getMonth(), 1, 12)); }}><div className="setom-month-day"><span>{date.getDate()}</span>{items.length > 0 && <b>{items.length}</b>}</div>{items.slice(0, 3).map((o) => <div className="setom-mini-order" key={o.id}>{String(o.os_number).padStart(5, "0")} · {o.address}</div>)}{items.length > 3 && <small>+ {items.length - 3} autre(s)</small>}</button>; })}</div>}
        {view === "semaine" && <div className="setom-week-grid">{weekCells.map((date, i) => { const key = iso(date); return <div className="setom-week-col" key={key}><div className="setom-week-head" style={{ borderTopColor: DAY_COLORS[i] }}><strong>{dayNames[i]}</strong><span>{date.getDate()}/{date.getMonth() + 1}</span></div><div className="setom-week-body">{(byDate.get(key) || []).map(renderOrder)}{(byDate.get(key) || []).length === 0 && <button className="setom-drop-empty" onClick={() => { setSelectedDate(key); setView("jour"); }}>+ Ajouter un OS</button>}</div></div>; })}</div>}
        {view === "jour" && <div className="setom-day-view"><div className="setom-day-title"><strong>{new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong><span>{selectedOrders.length} OS planifié(s)</span></div>{selectedOrders.map((o) => renderOrder(o))}<div className="setom-add-row"><select defaultValue="" onChange={(e) => { const o = orders.find((x) => String(x.id) === e.target.value); if (o) planOrder(o, selectedDate, o.team_id); e.target.value = ""; }}><option value="">+ Ajouter un OS à cette journée…</option>{orders.filter((o) => !o.planned_date).map((o) => <option key={o.id} value={o.id}>OS-{String(o.os_number).padStart(5, "0")} · {o.address}</option>)}</select></div></div>}
        {view === "classeur" && <div className="setom-binder"><div className="setom-binder-head"><div><strong>Classeur journalier</strong><span>{new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span></div><button onClick={() => window.print()}>🖨️ Imprimer</button></div>{selectedOrders.map((o, i) => <div className="setom-binder-card" key={o.id}><div className="setom-binder-number">{i + 1}</div><div><strong>OS-{new Date(o.creation_date).getFullYear()}-{String(o.os_number).padStart(5, "0")}</strong><span>{o.address}{o.city ? `, ${o.city}` : ""}</span><span>{o.material_detail || "Intervention"} · {o.planned_surface_m2 ? `${o.planned_surface_m2} m²` : "—"}</span><span>Équipe : {o.team_name}</span></div><div className="setom-binder-actions"><button onClick={() => moveOrder(o, -1)}>↑</button><button onClick={() => moveOrder(o, 1)}>↓</button></div></div>)}{selectedOrders.length === 0 && <p>Aucun OS planifié ce jour.</p>}</div>}
      </>}
      <footer className="setom-plan-footer"><strong>OS non planifiés : {orders.filter((o) => !o.planned_date).length}</strong><span>Les changements de date, d’équipe et de statut sont enregistrés dans SETOM.</span></footer>
    </div>
  </div>;
}

let root = null;
function openPlanner(event) {
  const button = event.target.closest("button");
  if (!button || !button.textContent.includes("Planning")) return;
  event.preventDefault(); event.stopPropagation();
  if (root) return;
  const host = document.createElement("div"); host.id = "setom-planner-host"; document.body.appendChild(host);
  root = createRoot(host);
  root.render(<Planner onClose={() => { root?.unmount(); root = null; host.remove(); }} />);
}
document.addEventListener("click", openPlanner, true);
