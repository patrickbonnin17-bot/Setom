import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Lightbulb, Route, Sparkles, Truck, X } from "lucide-react";
import { supabase } from "../supabase";

const CAPACITY_T = 8;
const tonnesFor = (o, m) => {
  const surface = Number(o?.planned_surface_m2 || o?.planned_road_surface_m2 || 0);
  const thickness = Number(m?.default_thickness_cm) || 6;
  const density = Number(m?.density_t_m3) || (/béton/i.test(m?.name || "") ? 2.4 : /grave|calcaire|gé/i.test((m?.name || "") + " " + (m?.category || "")) ? 1.8 : /sable/i.test(m?.name || "") ? 1.6 : 2.35);
  return Math.max(0, surface) * thickness / 100 * density;
};
const daysLeft = v => v ? Math.ceil((new Date(String(v).slice(0,10)+"T12:00:00") - new Date(new Date().toISOString().slice(0,10)+"T12:00:00")) / 86400000) : 999;
const dist = (a,b) => {
  if (![a?.latitude,a?.longitude,b?.latitude,b?.longitude].every(Number.isFinite)) return Infinity;
  const r=6371, p=Math.PI/180, dLat=(b.latitude-a.latitude)*p, dLon=(b.longitude-a.longitude)*p;
  const x=Math.sin(dLat/2)**2+Math.cos(a.latitude*p)*Math.cos(b.latitude*p)*Math.sin(dLon/2)**2;
  return 2*r*Math.asin(Math.sqrt(x));
};
const address = o => [o?.address,o?.postal_code,o?.city].filter(Boolean).join(", ");

const styles = `
.setom-ai-fab{position:fixed;right:22px;bottom:22px;z-index:120;border:0;border-radius:999px;background:#173f64;color:#fff;padding:12px 16px;display:flex;align-items:center;gap:9px;font:700 13px inherit;box-shadow:0 12px 30px rgba(17,43,68,.28);cursor:pointer}.setom-ai-panel{position:fixed;z-index:121;right:22px;bottom:78px;width:min(430px,calc(100vw - 28px));max-height:calc(100vh - 120px);overflow:auto;background:#fff;border:1px solid #d9e3eb;border-radius:18px;box-shadow:0 24px 65px rgba(13,37,60,.24);color:#193149}.setom-ai-head{padding:18px;border-bottom:1px solid #e8eef3;display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.setom-ai-title{display:flex;gap:10px;align-items:center}.setom-ai-icon{width:38px;height:38px;border-radius:11px;background:#eaf3f8;color:#20557e;display:grid;place-items:center}.setom-ai-head h3{margin:0;font-size:16px}.setom-ai-head p{margin:3px 0 0;color:#788999;font-size:11px}.setom-ai-close{border:0;background:#f3f6f8;border-radius:9px;padding:7px;cursor:pointer;color:#617486}.setom-ai-body{padding:16px}.setom-ai-toolbar{display:grid;grid-template-columns:1fr auto;gap:9px;margin-bottom:14px}.setom-ai-toolbar input{height:40px;border:1px solid #d5e0e8;border-radius:9px;padding:0 10px;font:inherit}.setom-ai-btn{border:1px solid #cbd8e2;background:#173f64;color:#fff;border-radius:9px;padding:0 12px;font-weight:750;cursor:pointer}.setom-ai-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:13px}.setom-ai-kpi{background:#f6f8fa;border-radius:10px;padding:10px}.setom-ai-kpi span{display:block;color:#758697;font-size:10px;text-transform:uppercase;font-weight:800}.setom-ai-kpi b{display:block;margin-top:3px;font-size:18px}.setom-ai-section{border:1px solid #e2e9ef;border-radius:12px;margin-top:10px;overflow:hidden}.setom-ai-section h4{margin:0;padding:10px 12px;background:#f7f9fb;font-size:12px}.setom-ai-list{padding:2px 12px 10px}.setom-ai-item{display:flex;gap:9px;padding:10px 0;border-bottom:1px solid #edf1f4;font-size:12px;line-height:1.4}.setom-ai-item:last-child{border-bottom:0}.setom-ai-item svg{flex:0 0 auto;margin-top:2px}.setom-ai-good{color:#2b7652}.setom-ai-warn{color:#9a641b}.setom-ai-danger{color:#a74643}.setom-ai-route{padding:10px 12px;background:#eef6fa;border:1px solid #d4e5ef;border-radius:10px;margin-top:12px;font-size:12px}.setom-ai-route b{display:block;margin-bottom:4px}.setom-ai-foot{padding:11px 16px;border-top:1px solid #e8eef3;color:#7a8b9a;font-size:10px}.setom-ai-empty{padding:22px 8px;text-align:center;color:#718394;font-size:12px}
`;

export default function SetomIntelligenceOverlay(){
  const [open,setOpen]=useState(false); const [day,setDay]=useState(new Date().toISOString().slice(0,10));
  const [data,setData]=useState({os:[],teams:[],trucks:[],interventions:[],materials:[],costs:[]}); const [loading,setLoading]=useState(false);
  const load=async()=>{setLoading(true);const [o,t,tr,i,m,c]=await Promise.all([
    supabase.from("work_orders").select("id,os_number,address,postal_code,city,latitude,longitude,deadline_date,status,material_id,planned_surface_m2,planned_road_surface_m2,problem_suspended"),
    supabase.from("teams").select("id,name,active").eq("active",true),
    supabase.from("setom_trucks").select("id,name,team_id,capacity_t,active").eq("active",true),
    supabase.from("interventions").select("work_order_id,team_id,planned_date,planned_order,planned_surface_m2").eq("planned_date",day).order("planned_order"),
    supabase.from("materials").select("id,name,density_t_m3,default_thickness_cm"),
    supabase.from("work_order_costs").select("work_order_id,amount_ht,amount_paid_ht,payment_status")
  ]);setData({os:o.data||[],teams:t.data||[],trucks:tr.data||[],interventions:i.data||[],materials:m.data||[],costs:c.data||[]});setLoading(false);};
  useEffect(()=>{if(open)load();},[open,day]);
  const analysis=useMemo(()=>{
    const planned=data.interventions.map(i=>({...i,os:data.os.find(o=>o.id===i.work_order_id)})).filter(x=>x.os&&!x.os.problem_suspended);
    const unscheduled=data.os.filter(o=>!o.problem_suspended&&!data.interventions.some(i=>i.work_order_id===o.id)&&!["Archivé","Payé","Réserve","En erreur","En attente"].includes(o.status));
    const teams=data.teams.map(team=>{const truck=data.trucks.find(t=>t.team_id===team.id);const rows=planned.filter(x=>x.team_id===team.id);const tons=rows.reduce((s,x)=>s+tonnesFor(x.os,data.materials.find(m=>m.id===x.os.material_id)),0);return {team,truck,rows,tons,loads:Math.ceil(tons/Number(truck?.capacity_t||CAPACITY_T))||0};});
    const totalTons=teams.reduce((s,x)=>s+x.tons,0), totalKm=[];
    const urgent=unscheduled.filter(o=>daysLeft(o.deadline_date)<=3).sort((a,b)=>daysLeft(a.deadline_date)-daysLeft(b.deadline_date));
    const suggestions=[];
    const unbalanced=teams.length>1 && Math.max(...teams.map(x=>x.tons),0)-Math.min(...teams.map(x=>x.tons),0)>CAPACITY_T*0.65;
    if(unbalanced)suggestions.push({tone:"warn",text:"La charge des équipes est déséquilibrée. Je recommande de déplacer les OS les plus proches géographiquement vers le camion le moins chargé, sans dépasser sa capacité."});
    teams.forEach(x=>{if(x.tons>Number(x.truck?.capacity_t||CAPACITY_T)*2)suggestions.push({tone:"warn",text:`${x.team.name} représente ${x.tons.toFixed(1)} t : prévois ${x.loads} chargements. Une répartition différente peut réduire les rotations.`});});
    if(urgent.length)suggestions.push({tone:"danger",text:`${urgent.length} OS non planifié(s) arrivent à échéance dans 3 jours ou moins. Ils doivent passer avant l'optimisation pure de distance.`});
    if(!suggestions.length)suggestions.push({tone:"good",text:"La journée est correctement équilibrée. L'optimisation peut maintenant chercher à réduire les kilomètres et les rotations sans dégrader les délais."});
    const routeHints=[];
    teams.forEach(x=>{
      const withCoords=x.rows.filter(r=>Number.isFinite(r.os.latitude)&&Number.isFinite(r.os.longitude));
      if(withCoords.length>=2){let remaining=[...withCoords], current=remaining.shift();const ordered=[current];while(remaining.length){remaining.sort((a,b)=>dist(current.os,a.os)-dist(current.os,b.os));current=remaining.shift();ordered.push(current);}const km=ordered.slice(1).reduce((s,r,idx)=>s+dist(ordered[idx].os,r.os),0);totalKm.push(km);routeHints.push({team:x.team.name,stops:ordered.map(r=>r.os.os_number||address(r.os)).filter(Boolean),km});}
    });
    const revenue=data.costs.reduce((s,c)=>s+Number(c.amount_ht||0),0); const paid=data.costs.reduce((s,c)=>s+Number(c.amount_paid_ht||0),0);
    return {planned,unscheduled,teams,totalTons,totalLoads:teams.reduce((s,x)=>s+x.loads,0),urgent,suggestions,routeHints,estimatedKm:totalKm.reduce((s,x)=>s+x,0),revenue,paid};
  },[data]);
  if(!open)return <><style>{styles}</style><button className="setom-ai-fab" onClick={()=>setOpen(true)}><Sparkles size={16}/> Copilote SETOM</button></>;
  return <><style>{styles}</style><button className="setom-ai-fab" onClick={()=>setOpen(false)}><X size={16}/> Fermer</button><aside className="setom-ai-panel">
    <div className="setom-ai-head"><div className="setom-ai-title"><span className="setom-ai-icon"><Sparkles size={19}/></span><div><h3>Copilote SETOM</h3><p>Optimisation métier • tournées • rentabilité</p></div></div><button className="setom-ai-close" onClick={()=>setOpen(false)}><X size={16}/></button></div>
    <div className="setom-ai-body">
      <div className="setom-ai-toolbar"><input type="date" value={day} onChange={e=>setDay(e.target.value)}/><button className="setom-ai-btn" onClick={load} disabled={loading}>{loading?"Analyse…":"Analyser"}</button></div>
      <div className="setom-ai-kpis"><div className="setom-ai-kpi"><span>Tonnage prévu</span><b>{analysis.totalTons.toFixed(1)} t</b></div><div className="setom-ai-kpi"><span>Chargements</span><b>{analysis.totalLoads}</b></div><div className="setom-ai-kpi"><span>OS non planifiés</span><b>{analysis.unscheduled.length}</b></div><div className="setom-ai-kpi"><span>Km estimés</span><b>{analysis.estimatedKm?analysis.estimatedKm.toFixed(1):"—"}</b></div></div>
      <section className="setom-ai-section"><h4>Diagnostic de la journée</h4><div className="setom-ai-list">{analysis.suggestions.map((s,i)=><div className="setom-ai-item" key={i}>{s.tone==="good"?<CheckCircle2 className="setom-ai-good" size={15}/>:<AlertTriangle className={s.tone==="danger"?"setom-ai-danger":"setom-ai-warn"} size={15}/>}<span>{s.text}</span></div>)}</div></section>
      <section className="setom-ai-section"><h4>Répartition par équipe / camion</h4><div className="setom-ai-list">{analysis.teams.map(x=><div className="setom-ai-item" key={x.team.id}><Truck size={15}/><span><b>{x.team.name}</b> → {x.truck?.name||"Camion non affecté"}<br/>{x.tons.toFixed(1)} t • {x.loads} chargement(s) • {x.rows.length} OS</span></div>)}</div></section>
      {analysis.routeHints.map((r,i)=><div className="setom-ai-route" key={i}><b><Route size={13} style={{verticalAlign:"-2px"}}/> Proposition tournée — {r.team}</b>{r.stops.join(" → ")}<br/><small>{r.km.toFixed(1)} km estimés entre arrêts — à confirmer avec le calcul routier.</small></div>)}
      <section className="setom-ai-section"><h4>Leviers de rentabilité</h4><div className="setom-ai-list">
        <div className="setom-ai-item"><Lightbulb className="setom-ai-good" size={15}/><span>Priorité 1 : limiter les rotations à vide et les détours en regroupant les OS par secteur et matériau.</span></div>
        <div className="setom-ai-item"><Lightbulb className="setom-ai-good" size={15}/><span>Priorité 2 : surveiller le taux de remplissage de chaque camion ; un camion à 4 t sur 8 t peut révéler une mauvaise affectation.</span></div>
        <div className="setom-ai-item"><Lightbulb className="setom-ai-good" size={15}/><span>Priorité 3 : comparer systématiquement tonnage prévu, tonnage réel, temps de tournée, kilomètres et montant facturé pour identifier les OS peu rentables.</span></div>
      </div></section>
    </div><div className="setom-ai-foot">Le moteur actuel applique des règles métier déterministes pour garantir des recommandations explicables. Le branchement d'un LLM pourra ensuite transformer ces diagnostics en véritable dialogue IA sans lui laisser inventer les données.</div>
  </aside></>;
}
