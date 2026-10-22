import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Route, Sparkles, Truck, X } from "lucide-react";
import { supabase } from "../supabase";
import buildRouteProposal from "./setomRouteOptimizer";

const css = `
.setom-route-fab{position:fixed;right:22px;bottom:76px;z-index:118;border:1px solid #d3e0ea;border-radius:999px;background:#fff;color:#173f64;padding:11px 15px;display:flex;align-items:center;gap:8px;font:750 12px inherit;box-shadow:0 12px 30px rgba(17,43,68,.16);cursor:pointer}
.setom-route-panel{position:fixed;z-index:119;right:22px;bottom:128px;width:min(650px,calc(100vw - 28px));max-height:calc(100vh - 160px);overflow:auto;background:#fff;border:1px solid #d9e3eb;border-radius:18px;box-shadow:0 24px 65px rgba(13,37,60,.24);color:#193149}
.setom-route-head{padding:18px;border-bottom:1px solid #e8eef3;display:flex;justify-content:space-between;gap:12px}.setom-route-title{display:flex;gap:10px;align-items:center}.setom-route-icon{width:38px;height:38px;border-radius:11px;background:#eaf3f8;color:#20557e;display:grid;place-items:center}.setom-route-head h3{margin:0;font-size:16px}.setom-route-head p{margin:3px 0 0;color:#788999;font-size:11px}.setom-route-close{border:0;background:#f3f6f8;border-radius:9px;padding:7px;cursor:pointer;color:#617486}
.setom-route-body{padding:16px}.setom-route-toolbar{display:grid;grid-template-columns:1fr auto auto;gap:8px;margin-bottom:14px}.setom-route-toolbar input,.setom-route-toolbar select{height:40px;border:1px solid #d5e0e8;border-radius:9px;padding:0 10px;background:#fff;font:inherit}.setom-route-btn{border:1px solid #cbd8e2;background:#173f64;color:#fff;border-radius:9px;padding:0 12px;font-weight:750;cursor:pointer}.setom-route-btn:disabled{opacity:.55;cursor:wait}.setom-route-validate{width:100%;height:42px;margin-top:13px;border:0;border-radius:10px;background:#1d6b4a;color:#fff;font-weight:850;cursor:pointer}.setom-route-validate:disabled{opacity:.5;cursor:not-allowed}.setom-route-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:13px}.setom-route-kpi{background:#f6f8fa;border-radius:10px;padding:10px}.setom-route-kpi span{display:block;color:#758697;font-size:10px;text-transform:uppercase;font-weight:800}.setom-route-kpi b{display:block;margin-top:3px;font-size:17px}.setom-route-card{border:1px solid #e2e9ef;border-radius:12px;margin-top:10px;overflow:hidden}.setom-route-card-head{padding:11px 12px;background:#f7f9fb;display:flex;justify-content:space-between;gap:10px;align-items:center}.setom-route-card-head b{font-size:12px}.setom-route-card-head span{font-size:11px;color:#6d7e8e}.setom-route-stop{display:grid;grid-template-columns:28px 1fr auto;gap:9px;padding:9px 12px;border-top:1px solid #edf1f4;font-size:12px}.setom-route-stop-num{width:24px;height:24px;border-radius:7px;background:#edf3f7;display:grid;place-items:center;font-size:10px;font-weight:850}.setom-route-stop small{display:block;color:#788999;margin-top:2px}.setom-route-stop strong{font-size:12px}.setom-route-tonnage{font-weight:800}.setom-route-loads{padding:9px 12px;border-top:1px solid #edf1f4;background:#fbfcfd;font-size:10px;color:#5d7181}.setom-route-alert{display:flex;gap:8px;background:#fff4e8;color:#8a5a1c;border:1px solid #efd4ae;padding:10px;border-radius:10px;font-size:11px;margin-top:9px}.setom-route-good{display:flex;gap:8px;background:#edf8f2;color:#246b4a;border:1px solid #cce7d8;padding:10px;border-radius:10px;font-size:11px;margin-top:9px}.setom-route-foot{padding:10px 16px;border-top:1px solid #e8eef3;color:#7a8b9a;font-size:10px}.setom-route-empty{text-align:center;padding:25px;color:#718394;font-size:12px}
@media(max-width:650px){.setom-route-fab{right:14px;bottom:76px}.setom-route-panel{right:8px;bottom:122px}.setom-route-toolbar{grid-template-columns:1fr 1fr}.setom-route-toolbar input{grid-column:1/-1}.setom-route-kpis{grid-template-columns:1fr 1fr}}
`;

const dayNow = () => new Date().toISOString().slice(0,10);
const euroPercent = (v) => `${Math.round(Math.max(0, Math.min(1, Number(v) || 0)) * 100)}%`;

export default function SetomRouteOptimizerOverlay(){
  const [open,setOpen]=useState(false);
  const [day,setDay]=useState(dayNow());
  const [teamCount,setTeamCount]=useState(2);
  const [loading,setLoading]=useState(false);
  const [applying,setApplying]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [data,setData]=useState({workOrders:[],interventions:[],teams:[],trucks:[],materials:[]});

  const load=async()=>{
    setLoading(true); setError(""); setMessage("");
    const [o,i,t,tr,m]=await Promise.all([
      supabase.from("work_orders").select("id,os_number,address,postal_code,city,latitude,longitude,deadline_date,status,material_id,planned_surface_m2,planned_road_surface_m2,problem_suspended,sector_id,parking_signage_required,parking_signage_placed_at"),
      supabase.from("interventions").select("id,work_order_id,team_id,planned_date,planned_order,planned_surface_m2"),
      supabase.from("teams").select("id,name,active").eq("active",true).order("name"),
      supabase.from("setom_trucks").select("id,name,team_id,capacity_t,active").eq("active",true).order("name"),
      supabase.from("materials").select("id,name,density_t_m3,default_thickness_cm,category").order("name")
    ]);
    const failures=[o,i,t,tr,m].filter(r=>r.error);
    if(failures.length) setError("Certaines données SETOM n'ont pas pu être chargées. La proposition reste bloquée pour éviter toute recommandation incomplète.");
    setData({workOrders:o.data||[],interventions:i.data||[],teams:t.data||[],trucks:tr.data||[],materials:m.data||[]});
    setLoading(false);
  };

  useEffect(()=>{if(open)load();},[open,day]);

  const protectedIds=useMemo(()=>new Set((data.interventions||[]).filter(i=>i.planned_date&&String(i.planned_date).slice(0,10)!==day).map(i=>i.work_order_id)),[data.interventions,day]);
  const proposal=useMemo(()=>buildRouteProposal({
    workOrders:data.workOrders.filter(o=>!protectedIds.has(o.id)),
    interventions:data.interventions,
    teams:data.teams,
    trucks:data.trucks,
    materials:data.materials,
    teamCount,
    capacityT:8,
    today:new Date(`${day}T12:00:00`),
  }),[data,teamCount,day,protectedIds]);

  const canValidate = !loading && !applying && !error && proposal.routes.some(route=>route.stops.length) && !proposal.routes.some(route=>route.stops.length && !route.truck) && proposal.unassigned.length === 0;

  const validatePlan = async()=>{
    if(!canValidate) return;
    const confirmed=window.confirm(`Valider la tournée du ${day} pour ${proposal.totals.assigned} OS, ${proposal.totals.tonnage.toFixed(1)} t et ${proposal.totals.rotations} rotation(s) ?\n\nChaque équipe conserve son propre camion, tonnage et matériau. Les OS déjà planifiés restent inchangés.`);
    if(!confirmed) return;
    setApplying(true); setError(""); setMessage("");
    try {
      const rows=proposal.routes.flatMap(route=>route.stops.map((stop,index)=>({
        ...(stop.intervention?.id ? {id:stop.intervention.id} : {}),
        work_order_id:stop.workOrder.id,
        team_id:route.team.id,
        planned_date:day,
        planned_order:index+1,
        planned_surface_m2:stop.workOrder.planned_surface_m2 ?? stop.workOrder.planned_road_surface_m2 ?? null,
      })));
      if(!rows.length) throw new Error("Aucun OS à enregistrer.");
      const {error:saveError}=await supabase.from("interventions").upsert(rows,{onConflict:"work_order_id"});
      if(saveError) throw saveError;
      setMessage(`Tournée validée : ${rows.length} OS enregistrés pour le ${day}.`);
      await load();
    } catch (e) {
      setError(`La validation n'a pas été enregistrée : ${e?.message || "erreur inconnue"}`);
    } finally { setApplying(false); }
  };

  if(!open) return <><style>{css}</style><button className="setom-route-fab" onClick={()=>setOpen(true)}><Route size={15}/> Préparer mes tournées</button></>;

  return <><style>{css}</style><button className="setom-route-fab" onClick={()=>setOpen(false)}><X size={15}/> Fermer</button><aside className="setom-route-panel">
    <div className="setom-route-head"><div className="setom-route-title"><span className="setom-route-icon"><Sparkles size={19}/></span><div><h3>Préparation intelligente des tournées</h3><p>Proposition SETOM • validation humaine obligatoire</p></div></div><button className="setom-route-close" onClick={()=>setOpen(false)}><X size={16}/></button></div>
    <div className="setom-route-body">
      <div className="setom-route-toolbar"><input type="date" value={day} onChange={e=>setDay(e.target.value)}/><select value={teamCount} onChange={e=>setTeamCount(Number(e.target.value))}><option value={1}>1 équipe</option><option value={2}>2 équipes</option><option value={3}>3 équipes</option></select><button className="setom-route-btn" onClick={load} disabled={loading}>{loading?"Analyse…":"Recalculer"}</button></div>
      {error&&<div className="setom-route-alert"><AlertTriangle size={15}/><span>{error}</span></div>}
      {message&&<div className="setom-route-good"><CheckCircle2 size={15}/><span>{message}</span></div>}
      {!error&&<>
        <div className="setom-route-kpis"><div className="setom-route-kpi"><span>OS proposés</span><b>{proposal.totals.assigned}/{proposal.totals.os}</b></div><div className="setom-route-kpi"><span>Tonnage</span><b>{proposal.totals.tonnage.toFixed(1)} t</b></div><div className="setom-route-kpi"><span>Rotations</span><b>{proposal.totals.rotations}</b></div><div className="setom-route-kpi"><span>Remplissage</span><b>{euroPercent(proposal.totals.averageFill)}</b></div></div>
        {proposal.routes.map(route=><section className="setom-route-card" key={route.team.id}><div className="setom-route-card-head"><div><b><Truck size={13} style={{verticalAlign:"-2px"}}/> {route.team.name} → {route.truck?.name || "camion manquant"}</b><span> • {route.tonnage.toFixed(1)} t • {route.totalRotations} rotation(s) • {route.km.toFixed(1)} km</span></div><span>{euroPercent(route.averageFill)} moyen</span></div>{route.stops.length?route.stops.map((stop,index)=><div className="setom-route-stop" key={stop.workOrder.id}><span className="setom-route-stop-num">{index+1}</span><span><strong>{stop.workOrder.os_number || "OS"}</strong> — {stop.workOrder.address || "Adresse non renseignée"}<small>{stop.material?.name || "Matériau à préciser"} • {stop.tonnage===null?"tonnage indisponible":`${stop.tonnage.toFixed(2)} t`} {stop.daysLeft!==null?`• ${stop.daysLeft} j`:""}</small></span><span className="setom-route-tonnage">{stop.urgency>=80?"URGENT":""}</span></div>):<div className="setom-route-empty">Aucun OS affecté à cette équipe.</div>}
          {route.loadPlan.length>0&&<div className="setom-route-loads"><b>Chargements :</b> {route.loadPlan.map(load=>`#${load.number} ${load.loadTonnage.toFixed(1)} t (${euroPercent(load.fillRate)})`).join(" • ")}</div>}
        </section>)}
        {proposal.unassigned.length>0&&<div className="setom-route-alert"><AlertTriangle size={15}/><span><b>{proposal.unassigned.length} OS non affecté(s).</b> Ils restent hors proposition plutôt que d'être placés sur un camion sans capacité ou sans donnée fiable.</span></div>}
        {proposal.warnings.length>0&&<div className="setom-route-alert"><AlertTriangle size={15}/><span>{proposal.warnings.map((w,i)=><React.Fragment key={i}>{i>0&&" • "}{w}</React.Fragment>)}</span></div>}
        {proposal.alreadyPlanned.length>0&&<div className="setom-route-good"><CheckCircle2 size={14}/><span>{proposal.alreadyPlanned.length} OS déjà planifié(s) ce jour : ils ne sont pas déplacés par cette proposition.</span></div>}
        {protectedIds.size>0&&<div className="setom-route-good"><CheckCircle2 size={14}/><span>{protectedIds.size} OS déjà planifié(s) à une autre date : ils sont protégés et ne seront pas écrasés par cette validation.</span></div>}
        <button className="setom-route-validate" onClick={validatePlan} disabled={!canValidate}>{applying?"Enregistrement…":"Valider la tournée et l'envoyer au planning"}</button>
        {!canValidate&&!applying&&<div className="setom-route-alert"><AlertTriangle size={15}/><span>Validation désactivée tant qu'un camion manque pour une équipe proposée ou qu'un OS reste non affecté. Les OS bloqués, incomplets ou déjà planifiés restent hors de la tournée.</span></div>}
      </>}
    </div><div className="setom-route-foot">Moteur déterministe : délais, regroupement matériau, équilibre des équipes, capacité propre à chaque camion, signalisation 48h et rotations plafonnées à 8 t. Les équipes sont indépendantes : aucun tonnage, matériau ou capacité n'est transféré automatiquement d'une équipe à l'autre.</div>
  </aside></>;
}
