import React, { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, GripVertical, MapPin, Sparkles, Truck } from "lucide-react";
import { buildTour, canShareTour, planningScore, validateTruckLoad } from "./planningEngine";
import { planningDays, planningOrders, planningTeams } from "./planningData";

const DAY_COLORS = { mon: "#2563eb", tue: "#159957", wed: "#e0a500", thu: "#e07818", fri: "#d64045" };

export default function PlanningView({ onOpenOs }) {
  const [orders, setOrders] = useState(planningOrders);
  const [selectedDay, setSelectedDay] = useState("mon");
  const [selectedTeam, setSelectedTeam] = useState("team-1");
  const [forceTwoMaterials, setForceTwoMaterials] = useState(false);
  const dayOrders = useMemo(() => orders.filter(o => o.day === selectedDay), [orders, selectedDay]);
  const tour = useMemo(() => buildTour(dayOrders, { maxPayloadTons: 8, forceTwoMaterials }), [dayOrders, forceTwoMaterials]);
  const totalSurface = dayOrders.reduce((s, o) => s + Number(o.plannedSurface || 0), 0);
  const totalTons = dayOrders.reduce((s, o) => s + Number(o.estimatedTons || 0), 0);

  const moveOrder = (id, day, teamId) => {
    const order = orders.find(o => o.id === id); if (!order) return;
    const target = orders.filter(o => o.day === day && o.teamId === teamId && o.id !== id);
    const incompatible = target.some(o => !canShareTour(o, order));
    const load = validateTruckLoad({ items: [...target, order], maxPayloadTons: 8 });
    if ((incompatible || !load.valid) && !forceTwoMaterials) return;
    setOrders(current => current.map(o => o.id === id ? { ...o, day, teamId, status: "planifie", forced: incompatible && forceTwoMaterials } : o));
  };

  const autoProposal = () => {
    const ranked = [...orders].sort((a,b) => planningScore(b) - planningScore(a));
    if (!ranked.length) return;
    setSelectedDay(ranked[0].day || "mon"); setSelectedTeam(ranked[0].teamId || "team-1");
  };

  return <div className="planning-v2">
    <div className="page-head"><div><p className="lead">Organisation terrain</p><h2>Planning opérationnel</h2><p className="muted">Qui fait quoi, où et quand — avec contrôle automatique des capacités.</p></div><div className="head-actions"><button className="btn secondary"><CalendarDays size={16}/> Cette semaine</button><button className="btn primary" onClick={autoProposal}><Sparkles size={16}/> Générer une proposition</button></div></div>
    <div className="kpis"><div className="card kpi"><span className="kpi-icon blue"><CalendarDays size={19}/></span><div><small>OS planifiés</small><strong>{orders.filter(o => o.day).length}</strong><em>cette semaine</em></div></div><div className="card kpi"><span className="kpi-icon green"><CheckCircle2 size={19}/></span><div><small>Équipes terrain</small><strong>{planningTeams.length}</strong><em>effectif configurable</em></div></div><div className="card kpi"><span className="kpi-icon amber"><MapPin size={19}/></span><div><small>Surface</small><strong>{totalSurface} m²</strong><em>sur le jour sélectionné</em></div></div><div className="card kpi"><span className="kpi-icon violet"><Truck size={19}/></span><div><small>Charge</small><strong>{totalTons.toFixed(1)} t</strong><em>sur le jour sélectionné</em></div></div></div>
    <div className="planning-toolbar card"><div><b>Proposition automatique</b><span>J+25 → matériau → surface → périphérie → circulation → géographie</span></div><label className="switch-row"><input type="checkbox" checked={forceTwoMaterials} onChange={e => setForceTwoMaterials(e.target.checked)}/><span>Forcer 2 matériaux</span></label>{forceTwoMaterials && <span className="warning-inline"><AlertTriangle size={15}/> Exception manuelle active</span>}</div>
    <div className="planning-board card"><div className="planning-board-head"><div><b>Vue équipes × jours</b><span>Glissez un OS vers un autre jour ou une autre équipe.</span></div><div className="planning-legend">{planningDays.map(d => <span key={d.id}><i style={{background:DAY_COLORS[d.id]}}/>{d.label}</span>)}</div></div><div className="planning-grid"><div className="planning-corner">Équipes</div>{planningDays.map(day => <button key={day.id} className={`planning-day ${selectedDay === day.id ? "selected" : ""}`} onClick={() => setSelectedDay(day.id)}><b>{day.label}</b><span>{day.date}</span></button>)}{planningTeams.map(team => <React.Fragment key={team.id}><div className={`team-row-label ${selectedTeam === team.id ? "selected" : ""}`} onClick={() => setSelectedTeam(team.id)}><b>{team.name}</b><span>{team.effectif} pers. · {team.vehicle}</span></div>{planningDays.map(day => <div key={`${team.id}-${day.id}`} className="planning-cell" onDragOver={e => e.preventDefault()} onDrop={e => moveOrder(e.dataTransfer.getData("os-id"), day.id, team.id)}>{orders.filter(o => o.day === day.id && o.teamId === team.id).map(o => <div key={o.id} draggable onDragStart={e => e.dataTransfer.setData("os-id", o.id)} className="planning-order" style={{borderLeftColor:DAY_COLORS[day.id]}} onClick={() => onOpenOs?.(o.id)}><div className="drag"><GripVertical size={14}/></div><div className="order-main"><b>{o.number}</b><strong>{o.address}</strong><span>{o.plannedSurface} m² · {o.material}{o.color ? ` ${o.color}` : ""}</span><small><MapPin size={12}/> {o.sector} · {o.traffic} circulation</small></div></div>)}</div>)}</React.Fragment>)}</div></div>
    <div className="planning-bottom"><section className="card proposal-card"><div className="card-head"><div><b>Proposition SETOM</b><span>Priorités calculées, sans déplacement automatique.</span></div><Sparkles size={18}/></div><div className="proposal-list">{[...orders].sort((a,b)=>planningScore(b)-planningScore(a)).slice(0,4).map((o,i)=><button key={o.id} onClick={()=>{setSelectedDay(o.day||"mon");setSelectedTeam(o.teamId||"team-1");onOpenOs?.(o.id)}}><strong>#{i+1}</strong><div><b>{o.number}</b><span>{o.address} · {o.plannedSurface} m² · échéance {o.deadline}</span></div><ArrowRight size={15}/></button>)}</div></section><section className="card capacity-card"><div className="section-title">Tournée sélectionnée <span>{selectedDay}</span></div><div className="capacity-main"><b>{tour.load.totalTons.toFixed(1)} / 8 t</b><span>charge camion</span></div><div className="progress"><i style={{width:`${Math.min(100,(tour.load.totalTons/8)*100)}%`}}/></div>{tour.load.reasons.map(r=><div className="warning-inline" key={r}><AlertTriangle size={14}/>{r}</div>)}{!tour.load.reasons.length&&<div className="load-ok"><CheckCircle2 size={14}/> Tournée compatible</div>}<p className="muted">Une seule matière par tournée. Pour l'enrobé : une seule couleur.</p></section></div>
  </div>;
}
