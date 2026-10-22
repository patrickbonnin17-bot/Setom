import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, Factory, Gauge, MapPin, Plus, RefreshCw, Truck, X } from "lucide-react";
import { supabase } from "../supabase";
import "./setom-daily-loads.css";

const CAPACITY_T = 8;
const CENTRALS = [
  { id: "enrobe", label: "Centrale enrobé", hint: "Chargement quotidien des enrobés" },
  { id: "beton", label: "Centrale béton", hint: "Chargement quotidien du béton" },
  { id: "autres", label: "Centrale autres", hint: "Autres matériaux selon le chantier" },
  { id: "site", label: "Stock chantier", hint: "Uniquement sable 0/2 — joints sablés" },
];
const today = () => { const d = new Date(); return d.toISOString().slice(0,10); };
const fmt = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Number(n) || 0);
const tonne = (surface, mat) => Math.max(0, Number(surface)||0) * Math.max(0, Number(mat?.default_thickness_cm)||0) / 100 * Math.max(0, Number(mat?.density_t_m3)||0);
const materialLabel = (m) => m?.name || "Matériau à préciser";

function TruckIllustration({ fill=0, tone="blue" }) {
  const level = Math.max(0, Math.min(100, fill));
  return <div className={`sdl-truck ${tone}`} aria-label={`Benne chargée à ${Math.round(level)} %`}>
    <div className="sdl-cab"><span>SETOM</span></div>
    <div className="sdl-bed"><div className="sdl-pile" style={{ height: `${Math.max(12, level * .72)}%` }} /></div>
    <div className="sdl-wheel w1" /><div className="sdl-wheel w2" />
  </div>;
}

export default function SetomDailyLoadsOverlay() {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [teams, setTeams] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [orders, setOrders] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [loads, setLoads] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [central, setCentral] = useState({});
  const [selectedMaterial, setSelectedMaterial] = useState({});
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const isTruck = (node) => /Camion\s*&\s*matériaux|Camions\s*&\s*chargements|Chargements/i.test(node?.textContent || "");
    const onClick = (event) => {
      const el = event.target?.closest?.("button,a,[role='button']");
      if (!el) return;
      if (isTruck(el)) setOpen(true);
      else if (/Tableau de bord|Ordres de service|Planning|Carte|Classeur|Travaux réalisés|Constats|Suivi financier|Bordereau de prix|Équipes|Paramètres/i.test(el.textContent || "")) setOpen(false);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      const [t, tr, m, o, i, l] = await Promise.all([
        supabase.from("teams").select("*").eq("active", true).order("name"),
        supabase.from("setom_trucks").select("*").eq("active", true).order("name"),
        supabase.from("materials").select("*").neq("active", false).order("sort_order", { ascending: true }),
        supabase.from("work_orders").select("*").not("status", "in", "(Archivé,Payé,Réserve,En erreur,En attente)"),
        supabase.from("interventions").select("*"),
        supabase.from("truck_daily_loads").select("*").eq("load_date", date).order("created_at", { ascending: true })
      ]);
      if (cancelled) return;
      setTeams(t.data || []); setTrucks(tr.data || []); setMaterials(m.data || []); setOrders(o.data || []); setInterventions(i.data || []); setLoads(l.data || []);
      setSelectedMaterial(prev => {
        const next = { ...prev };
        (tr.data || []).forEach(x => { if (!next[x.id]) next[x.id] = (m.data || [])[0]?.id || ""; });
        return next;
      });
    };
    load().catch(e => setMessage({ type: "error", text: e.message || "Chargement impossible" }));
    return () => { cancelled = true; };
  }, [open, date]);

  const needByTeam = useMemo(() => {
    const map = {};
    interventions.filter(i => i.planned_date === date).forEach(i => {
      const os = orders.find(o => o.id === i.work_order_id);
      if (!os || !i.team_id) return;
      const mat = materials.find(m => m.id === (i.material_id || os.material_id));
      const value = tonne(i.planned_surface_m2 || os.planned_surface_m2, mat);
      map[i.team_id] = (map[i.team_id] || 0) + value;
    });
    return map;
  }, [date, interventions, orders, materials]);

  const loadedByTruck = useMemo(() => {
    const map = {};
    loads.forEach(l => { if (l.truck_id) map[l.truck_id] = (map[l.truck_id] || 0) + (l.unit === "kg" ? Number(l.loaded_quantity||0)/1000 : Number(l.loaded_quantity||0)); });
    return map;
  }, [loads]);

  const lastLoadsByTruck = useMemo(() => {
    const map = {};
    loads.forEach(l => { if (l.truck_id) map[l.truck_id] = [...(map[l.truck_id] || []), l]; });
    return map;
  }, [loads]);

  const centralForMaterial = (mat) => {
    const n = (mat?.name || "").toLowerCase();
    if (/béton/.test(n)) return "beton";
    if (/enrobé|asphalte/.test(n)) return "enrobe";
    if (/sable 0\/2/.test(n)) return "site";
    return "autres";
  };

  const updateDraft = (truckId, delta) => {
    setDrafts(prev => {
      const current = Number(prev[truckId] || 0);
      const truck = trucks.find(t => t.id === truckId);
      const next = Math.max(0, Math.min(Number(truck?.capacity_t || CAPACITY_T), current + delta));
      return { ...prev, [truckId]: next };
    });
  };

  const saveRotation = async (truck, finish=false) => {
    const qty = Number(drafts[truck.id] || 0);
    if (qty <= 0) return;
    const materialId = selectedMaterial[truck.id];
    if (!materialId) { setMessage({ type: "error", text: "Choisis le matériau avant d'enregistrer la rotation." }); return; }
    const material = materials.find(m => m.id === materialId);
    setSaving(truck.id);
    const { data: sessionData } = await supabase.auth.getSession();
    const payload = {
      load_date: date,
      material_id: materialId,
      loaded_quantity: qty,
      unit: "t",
      truck_id: truck.id,
      created_by: sessionData?.session?.user?.id || null,
      notes: `Approvisionnement : ${CENTRALS.find(c => c.id === (central[truck.id] || centralForMaterial(material)))?.label || "Centrale"}`
    };
    const { data, error } = await supabase.from("truck_daily_loads").insert(payload).select("*").single();
    setSaving(null);
    if (error) { setMessage({ type: "error", text: error.message }); return; }
    setLoads(prev => [...prev, data]);
    setDrafts(prev => ({ ...prev, [truck.id]: 0 }));
    setMessage({ type: "success", text: finish ? "Rotation enregistrée et camion prêt au départ." : "Rotation enregistrée." });
  };

  const teamForTruck = (truck) => teams.find(t => t.id === truck.team_id);
  const availableMaterials = materials.filter(m => !/sable 0\/2/i.test(m.name) || central["site"]);
  const permanentSand = materials.find(m => /sable 0\/2/i.test(m.name));

  if (!open) return null;
  return <div className="sdl-shell">
    <aside className="sdl-side-spacer" />
    <main className="sdl-main">
      <header className="sdl-head">
        <div><div className="sdl-eyebrow">SETOM • LOGISTIQUE TERRAIN</div><h1>Camions & chargements</h1><p>Préparation quotidienne des chargements par équipe et suivi des rotations</p></div>
        <div className="sdl-date"><button onClick={() => setDate(d => { const x=new Date(d+"T12:00:00"); x.setDate(x.getDate()-1); return x.toISOString().slice(0,10); })}><ChevronLeft size={18}/></button><CalendarDays size={18}/><strong>{new Date(date+"T12:00:00").toLocaleDateString("fr-FR", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })}</strong><button onClick={() => setDate(d => { const x=new Date(d+"T12:00:00"); x.setDate(x.getDate()+1); return x.toISOString().slice(0,10); })}><ChevronRight size={18}/></button></div>
      </header>

      {message && <div className={`sdl-message ${message.type}`}><span>{message.text}</span><button onClick={() => setMessage(null)}><X size={16}/></button></div>}

      <section className="sdl-rule"><Gauge size={18}/><div><strong>Règle SETOM</strong><span>1 équipe = 1 camion • capacité utile maximale 8 t • aucune mutualisation de matériau entre équipes.</span></div></section>

      {trucks.length === 0 && <section className="sdl-empty"><Truck size={28}/><div><strong>Aucun camion actif n’est encore configuré.</strong><span>La page est prête : crée les camions dans le module Équipes, puis ils apparaîtront automatiquement ici.</span></div></section>}

      <section className="sdl-grid">
        {trucks.map((truck, index) => {
          const team = teamForTruck(truck); const cap = Number(truck.capacity_t || CAPACITY_T); const dayLoaded = Number(loadedByTruck[truck.id] || 0); const draft = Number(drafts[truck.id] || 0); const fill = Math.min(100, draft / cap * 100); const need = Number(needByTeam[truck.team_id] || 0); const material = materials.find(m => m.id === selectedMaterial[truck.id]);
          return <article className={`sdl-card tone-${index % 3}`} key={truck.id}>
            <div className="sdl-card-head"><div><div className="sdl-team"><span>ÉQUIPE</span> {team?.name || "Équipe non affectée"}</div><h2>{truck.name || `Camion ${index+1}`} <small>{truck.registration || "Immatriculation à renseigner"}</small></h2><div className="sdl-driver">{truck.driver_name || "Conducteur à renseigner"}</div></div><span className="sdl-status">{draft >= cap ? "PRÊT AU DÉPART" : draft > 0 ? "EN CHARGEMENT" : "À CHARGER"}</span></div>
            <div className="sdl-central"><Factory size={16}/><select value={central[truck.id] || centralForMaterial(material)} onChange={e => setCentral(p => ({...p,[truck.id]:e.target.value}))}>{CENTRALS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
            <TruckIllustration fill={fill} tone={index % 3 === 1 ? "purple" : index % 3 === 2 ? "green" : "blue"}/>
            <div className="sdl-metrics"><div><span>Prévu (planning)</span><strong>{fmt(need)} t</strong></div><div><span>Chargé aujourd’hui</span><strong>{fmt(dayLoaded)} t</strong></div><div><span>Chargement en cours</span><strong>{fmt(draft)} t</strong></div><div><span>Reste capacité</span><strong className={draft >= cap ? "red" : ""}>{fmt(cap-draft)} t</strong></div></div>
            <div className="sdl-load-row"><select value={selectedMaterial[truck.id] || ""} onChange={e => setSelectedMaterial(p => ({...p,[truck.id]:e.target.value}))}><option value="">Matériau à charger</option>{availableMaterials.map(m => <option key={m.id} value={m.id}>{materialLabel(m)}</option>)}</select><div className="sdl-step"><button onClick={() => updateDraft(truck.id,-0.5)}>−</button><strong>{fmt(draft)} t</strong><button onClick={() => updateDraft(truck.id,0.5)} disabled={draft >= cap}>+</button></div><button className="sdl-primary" onClick={() => updateDraft(truck.id,0.5)} disabled={draft >= cap}><Plus size={17}/> Ajouter</button></div>
            <div className="sdl-actions"><button onClick={() => saveRotation(truck,true)} disabled={!draft || saving===truck.id}><Check size={16}/> Terminer la rotation</button><button onClick={() => { if(draft) saveRotation(truck,true); }} disabled={!draft}><Truck size={16}/> Vider / départ</button></div>
            <div className="sdl-rotation"><span>{(lastLoadsByTruck[truck.id] || []).length + (draft > 0 ? 1 : 0)} rotation(s) enregistrée(s) aujourd’hui</span><span>{material ? materialLabel(material) : "Aucun matériau sélectionné"}</span></div>
          </article>;
        })}
      </section>

      <section className="sdl-bottom-grid">
        <div className="sdl-panel"><div className="sdl-panel-title"><div><h3>Approvisionnement du jour</h3><p>Les matériaux sont chargés à la centrale chaque jour.</p></div><RefreshCw size={18}/></div><div className="sdl-central-grid">{CENTRALS.filter(c => c.id !== "site").map(c => <div className="sdl-central-card" key={c.id}><Factory size={21}/><strong>{c.label}</strong><span>{c.hint}</span><small><MapPin size={12}/> Source à préciser dans le planning</small></div>)}</div></div>
        <div className="sdl-panel"><div className="sdl-panel-title"><div><h3>Besoin du jour</h3><p>Calcul issu des interventions planifiées.</p></div><Gauge size={18}/></div><div className="sdl-need-list">{teams.map(team => { const truck = trucks.find(t => t.team_id === team.id); const need = Number(needByTeam[team.id] || 0); return <div key={team.id}><span>{team.name}</span><strong>{fmt(need)} t</strong><em>{truck ? truck.name : "Camion non affecté"}</em></div>; })}{!teams.length && <p className="sdl-muted">Aucune équipe active configurée.</p>}</div></div>
      </section>

      <section className="sdl-bottom-grid">
        <div className="sdl-panel sand"><div className="sdl-panel-title"><div><h3>Big-bag sable 0/2</h3><p>Seul stock permanent sur le chantier — joints sablés.</p></div><span className="sdl-stock-pill">STOCK CHANTIER</span></div><div className="sdl-sand"><div className="sdl-bigbag">SABLE<br/>0/2</div><div><span>Stock à suivre</span><strong>Quantité à renseigner</strong><p>Ce stock est indépendant des matériaux chargés en centrale.</p></div></div></div>
        <div className="sdl-panel"><div className="sdl-panel-title"><div><h3>Rotations enregistrées</h3><p>Traçabilité réelle des chargements.</p></div></div><div className="sdl-table"><div className="sdl-tr"><span>Heure</span><span>Équipe</span><span>Camion</span><span>Matériau</span><span>Tonnage</span><span>Source</span></div>{loads.slice(-8).reverse().map((l, idx) => { const tr=trucks.find(t=>t.id===l.truck_id); const tm=teams.find(t=>t.id===tr?.team_id); const mat=materials.find(m=>m.id===l.material_id); return <div className="sdl-tr" key={l.id || idx}><span>{l.created_at ? new Date(l.created_at).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}) : "—"}</span><span>{tm?.name || "—"}</span><span>{tr?.name || "—"}</span><span>{materialLabel(mat)}</span><span><strong>{fmt(l.unit === "kg" ? Number(l.loaded_quantity)/1000 : l.loaded_quantity)} t</strong></span><span>{(l.notes || "Centrale").replace("Approvisionnement : ","")}</span></div>})}{!loads.length && <div className="sdl-no-row">Aucune rotation enregistrée pour cette journée.</div>}</div></div>
      </section>
    </main>
  </div>;
}
