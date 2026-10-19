import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Bell, CalendarDays, Camera,
  CheckCircle2, ChevronRight, ClipboardList, Clock3, FileText, LayoutDashboard, Map,
  Menu, MoreHorizontal, Package, Search, Settings, Sparkles, Truck, Users, WalletCards, X
} from "lucide-react";
import { INITIAL_OS, DOSSIER_TYPES, STATUS, addDays, allowedTransitions, canSubmitForChiefValidation, createOs } from "./model";
import "./style.css";

const NAV = [
  ["dashboard", "Tableau de bord", LayoutDashboard], ["os", "OS", ClipboardList], ["classeur", "Classeur", FileText],
  ["planning", "Planning", CalendarDays], ["carte", "Carte", Map], ["travaux", "Travaux", Activity],
  ["constats", "Constats", FileText], ["reserves", "Réserves", AlertTriangle], ["bpu", "BPU", BarChart3],
  ["materiaux", "Matériaux", Package], ["vehicules", "Véhicules", Truck], ["equipe", "Équipe", Users],
  ["clients", "Clients & Marchés", Users], ["financier", "Financier", WalletCards], ["rapports", "Rapports", BarChart3],
  ["parametres", "Paramètres", Settings],
];

const DAY_COLORS = { Lundi: "#2563eb", Mardi: "#159957", Mercredi: "#e0a500", Jeudi: "#e07818", Vendredi: "#d64045" };
const STATUS_TONE = {
  [STATUS.CREATED]: "blue", [STATUS.PLANNED]: "violet", [STATUS.IN_PROGRESS]: "amber", [STATUS.WAITING_CHIEF]: "gray",
  [STATUS.WAITING_CLIENT]: "gray", [STATUS.CLIENT_VALIDATED]: "green", [STATUS.RESERVE]: "red", [STATUS.CORRECTION]: "orange",
  [STATUS.TO_INVOICE]: "violet", [STATUS.INVOICED]: "green", [STATUS.PAID]: "green", [STATUS.CLOSED]: "gray", [STATUS.DONE]: "green",
};

function Badge({ children }) { return <span className={`badge ${STATUS_TONE[children] || "gray"}`}>{children}</span>; }
function Card({ children, className = "" }) { return <section className={`card ${className}`}>{children}</section>; }
function Kpi({ label, value, hint, icon: Icon, tone = "blue" }) { return <Card className="kpi"><span className={`kpi-icon ${tone}`}><Icon size={19}/></span><div><small>{label}</small><strong>{value}</strong><em>{hint}</em></div></Card>; }

function App() {
  const [page, setPage] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [osList, setOsList] = useState(INITIAL_OS);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const selected = osList.find(o => o.id === selectedId) || null;
  const filtered = useMemo(() => osList.filter(o => `${o.number} ${o.address} ${o.client} ${o.material} ${o.sector}`.toLowerCase().includes(query.toLowerCase())), [osList, query]);
  const go = p => { setPage(p); setSelectedId(null); setMobileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openOs = id => { setSelectedId(id); setPage("os"); };
  const create = input => { const os = createOs(osList, input); setOsList(current => [os, ...current]); setCreateOpen(false); setSelectedId(os.id); setPage("os"); };
  const updateOs = patch => setOsList(current => current.map(o => o.id === selectedId ? { ...o, ...patch } : o));

  return <div className="app">
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark">S</div><div><b>SETOM</b><span>Gestion opérationnelle</span></div></div>
      <div className="side-scroll">{NAV.map(([id, label, Icon]) => <button key={id} className={`nav-item ${page === id && !selected ? "active" : ""}`} onClick={() => go(id)}><Icon size={18}/><span>{label}</span></button>)}</div>
      <div className="user-card"><div className="avatar">PB</div><div><b>Patrick</b><span>Administrateur</span></div><MoreHorizontal size={17}/></div>
    </aside>
    {mobileOpen && <div className="backdrop" onClick={() => setMobileOpen(false)}/>} 
    <main className="main">
      <header className="topbar">
        <button className="icon-btn mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={21}/></button>
        <div><div className="eyebrow">SETOM / {selected ? selected.number : pageTitle(page)}</div><h1>{selected ? selected.address : pageTitle(page)}</h1></div>
        <div className="top-actions"><div className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un OS, une adresse…"/></div><button className="icon-btn"><Bell size={19}/><i/></button><div className="avatar large">PB</div></div>
      </header>
      <div className="content">
        {selected ? <OsDossier os={selected} onBack={() => setSelectedId(null)} updateOs={updateOs} /> : page === "dashboard" ? <Dashboard go={go} openOs={openOs} osList={osList} /> : page === "os" ? <OSList osList={filtered} openOs={openOs} create={() => setCreateOpen(true)} /> : <ModulePage title={pageTitle(page)} go={go} />}
      </div>
    </main>
    {createOpen && <CreateOsModal onClose={() => setCreateOpen(false)} onCreate={create}/>} 
  </div>;
}

function pageTitle(page) { return NAV.find(x => x[0] === page)?.[1] || "Tableau de bord"; }

function Dashboard({ go, openOs, osList }) {
  const urgent = osList.filter(o => o.status !== STATUS.CLOSED && o.dueDate <= "2026-10-22");
  return <>
    <div className="page-head"><div><p className="lead">Vue d'ensemble de l'activité</p><h2>Bonjour Patrick, voici ce qui mérite votre attention.</h2></div><div className="head-actions"><select><option>Cette semaine</option><option>Ce mois</option></select><button className="btn primary" onClick={() => go("os")}>+ Nouvel OS</button></div></div>
    <div className="kpis"><Kpi label="OS à réaliser" value={osList.filter(o => ![STATUS.CLOSED, STATUS.CLIENT_VALIDATED, STATUS.PAID].includes(o.status)).length} hint="Priorité J+25" icon={ClipboardList}/><Kpi label="En cours" value={osList.filter(o => o.status === STATUS.IN_PROGRESS).length} hint="Équipes terrain" icon={Activity} tone="amber"/><Kpi label="Terminés" value={osList.filter(o => [STATUS.DONE, STATUS.CLIENT_VALIDATED].includes(o.status)).length} hint="Cette période" icon={CheckCircle2} tone="green"/><Kpi label="Réserves" value={osList.filter(o => o.status === STATUS.RESERVE).length} hint="À corriger" icon={AlertTriangle} tone="red"/></div>
    <div className="grid-main"><Card className="map-card"><div className="card-head"><div><b>Carte opérationnelle</b><span>Couleur = jour planifié · statut séparé</span></div><button className="link-btn" onClick={() => go("carte")}>Ouvrir la carte <ArrowRight size={15}/></button></div><MapMock osList={osList}/></Card><Card><div className="card-head"><div><b>À traiter aujourd'hui</b><span>Priorités opérationnelles</span></div></div><div className="priority-list">{urgent.slice(0,4).map(o => <button key={o.id} onClick={() => openOs(o.id)}><span className={`priority-icon ${o.dueDate <= "2026-10-21" ? "red" : "blue"}`}><Clock3 size={15}/></span><div><b>{o.number}</b><small>{o.dueDate} · {o.material}</small></div><ChevronRight size={16}/></button>)}{urgent.length === 0 && <p className="muted">Aucune urgence.</p>}</div></Card></div>
    <div className="grid-3"><Card><div className="section-title">Planning du jour <span>4 équipes</span></div><div className="list-lines"><div><b>Équipe 1</b><span>3 OS · 96 m²</span></div><div><b>Équipe 2</b><span>2 OS · Enrobé noir</span></div><div><b>Équipe 3</b><span>2 OS · Enrobé rouge</span></div><div><b>Équipe 4</b><span>1 OS · Corrective</span></div></div></Card><Card><div className="section-title">Logistique <span>aujourd'hui</span></div><div className="big-metric">28,4 <small>t d'enrobé prévu</small></div><div className="progress"><i style={{width:"71%"}}/></div><div className="muted">Une couleur d'enrobé par tournée.</div></Card><Card className="ai-card"><div className="ai-title"><Sparkles size={18}/> Conseiller IA SETOM</div><b>3 recommandations</b><p>Regrouper les OS compatibles du secteur Nord et prioriser l'OS proche de J+25.</p><button className="link-btn">Voir les conseils <ArrowRight size={14}/></button></Card></div>
  </>;
}

function OSList({ osList, openOs, create }) {
  return <><div className="page-head"><div><p className="lead">Dossiers opérationnels</p><h2>Ordres de service</h2></div><button className="btn primary" onClick={create}>+ Créer un OS</button></div><div className="filters"><button className="filter active">Tous <b>{osList.length}</b></button><button className="filter">À planifier <b>{osList.filter(o => o.status === STATUS.CREATED).length}</b></button><button className="filter">En cours <b>{osList.filter(o => o.status === STATUS.IN_PROGRESS).length}</b></button><button className="filter">Validation <b>{osList.filter(o => o.status.includes("validation")).length}</b></button><button className="filter">Réserves <b>{osList.filter(o => o.status === STATUS.RESERVE).length}</b></button></div><div className="os-list">{osList.map(o => <OSCard key={o.id} os={o} open={() => openOs(o.id)}/>)}</div></>;
}

function OSCard({ os, open }) {
  return <article className="os-card" onClick={open}><div className="os-photo"><div className="photo-placeholder"><Map size={34}/></div><Badge>{os.status}</Badge>{os.plannedDay && <span className="day-chip" style={{background: DAY_COLORS[os.plannedDay]}}>{os.plannedDay}</span>}</div><div className="os-body"><div className="os-card-top"><div><span className="os-id">{os.number}</span><h3>{os.address}</h3><span className="muted">{os.client} · {os.sector}</span></div><MoreHorizontal size={19}/></div><div className="facts"><span><b>{os.plannedSurface || "—"} m²</b> surface</span><span><b>{os.material}</b></span><span><b>{os.team || "—"}</b> équipe</span><span><b>{formatDate(os.dueDate)}</b> limite</span></div><div className="os-footer"><span className={`deadline ${daysTo(os.dueDate) <= 3 ? "danger" : ""}`}><Clock3 size={14}/> J+25 · {formatDate(os.dueDate)}</span><button className="btn small" onClick={e => { e.stopPropagation(); open(); }}>Ouvrir le dossier <ArrowRight size={14}/></button></div></div></article>;
}

function OsDossier({ os, onBack, updateOs }) {
  const [tab, setTab] = useState("informations");
  const transitions = allowedTransitions(os);
  const internal = os.type === DOSSIER_TYPES.INTERNAL;
  const actionLabel = os.status === STATUS.CREATED ? "Planifier l'intervention" : os.status === STATUS.PLANNED ? "Démarrer l'intervention" : os.status === STATUS.IN_PROGRESS ? "Soumettre pour validation" : transitions[0] || "";
  const actionTarget = os.status === STATUS.CREATED ? STATUS.PLANNED : os.status === STATUS.PLANNED ? STATUS.IN_PROGRESS : os.status === STATUS.IN_PROGRESS ? STATUS.WAITING_CHIEF : transitions[0];
  const blocked = os.status === STATUS.IN_PROGRESS && !canSubmitForChiefValidation(os);
  const doAction = () => { if (blocked) return; if (actionTarget) updateOs({ status: actionTarget }); };

  return <div className="dossier"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Retour aux OS</button><div className="dossier-head"><div><div className="eyebrow">DOSSIER OPÉRATIONNEL</div><div className="dossier-title-row"><h2>{os.number}</h2><Badge>{os.status}</Badge><span className="type-pill">{internal ? "Travail interne Eurovia" : "Marché client"}</span></div><h3>{os.address}</h3><p>{os.client}{os.market ? ` · ${os.market}` : ""} · Secteur {os.sector}</p></div><div className="dossier-actions"><button className="btn secondary">Modifier</button>{actionLabel && <button className={`btn ${blocked ? "disabled" : "primary"}`} onClick={doAction} disabled={blocked}>{actionLabel}<ArrowRight size={15}/></button>}</div></div><div className="trace"><span>Créé par <b>{os.creator}</b></span><span>{formatDateTime(os.createdAt)}</span><span>Date limite <b>{formatDate(os.dueDate)}</b></span></div>
    <div className="tabs">{[["informations","Informations"],["travaux","Travaux"],["photos","Photos"],["documents","Documents"],["suivi","Suivi"]].map(([id,label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === "informations" && <InfoTab os={os}/>} {tab === "travaux" && <WorkTab os={os} updateOs={updateOs}/>} {tab === "photos" && <PhotosTab os={os} updateOs={updateOs}/>} {tab === "documents" && <DocumentsTab/>} {tab === "suivi" && <HistoryTab os={os}/>} 
  </div>;
}

function InfoTab({ os }) {
  return <div className="dossier-grid"><Card><div className="section-title">Informations chantier</div><div className="info-grid"><Info label="Type de dossier" value={os.type}/><Info label="Client / entité" value={os.client}/><Info label="Marché" value={os.market || "—"}/><Info label="Secteur" value={os.sector}/><Info label="Adresse" value={os.address}/><Info label="Matériau" value={`${os.material}${os.color ? ` · ${os.color}` : ""}`}/><Info label="Surface prévue" value={`${os.plannedSurface || 0} m²`}/><Info label="Surface réalisée" value={os.actualSurface ? `${os.actualSurface} m²` : "Non renseignée"}/></div></Card><Card><div className="section-title">Affectation</div><div className="assignment"><div><span>Équipe</span><b>{os.team || "À planifier"}</b></div><div><span>Véhicule</span><b>{os.vehicle || "À affecter"}</b></div><div><span>Jour</span><b>{os.plannedDay || "Non planifié"}</b></div><div><span>Circulation</span><b>{os.traffic}</b></div></div></Card><Card className="map-panel"><div className="section-title">Localisation <button className="link-btn">Ouvrir la carte</button></div><MapMock osList={[os]}/></Card><Card><div className="section-title">Échéance J+25</div><div className={`deadline-large ${daysTo(os.dueDate) <= 3 ? "danger" : ""}`}><Clock3 size={20}/><div><b>{formatDate(os.dueDate)}</b><span>{daysTo(os.dueDate) < 0 ? "Échéance dépassée" : `J-${daysTo(os.dueDate)}`}</span></div></div><p className="muted">La date limite est calculée automatiquement à partir de la création du dossier.</p></Card></div>;
}
function Info({ label, value }) { return <div className="info"><span>{label}</span><b>{value}</b></div>; }

function WorkTab({ os, updateOs }) {
  const [surface, setSurface] = useState(os.actualSurface ?? "");
  const [thickness, setThickness] = useState(os.zones?.[0]?.thickness ?? 6);
  const [overwidth, setOverwidth] = useState(os.zones?.[0]?.overwidth ?? "Pleine largeur");
  const save = () => updateOs({ actualSurface: Number(surface) || null, zones: [{ ...(os.zones?.[0] || { name: "Chaussée", planned: os.plannedSurface }), actual: Number(surface) || null, thickness: Number(thickness), overwidth }] });
  return <div className="work-layout"><Card><div className="section-title">Zones de traitement <span>Prévu / réalisé</span></div><div className="zone-row"><div><b>{os.zones?.[0]?.name || "Chaussée"}</b><small>{os.material}</small></div><strong>{os.plannedSurface} m²</strong><input value={surface} onChange={e => setSurface(e.target.value)} placeholder="Réalisé"/><span>m²</span></div><button className="btn secondary">+ Ajouter une mesure</button></Card><Card><div className="section-title">Paramètres de mise en œuvre</div><div className="field-grid"><label>Épaisseur réelle<input value={thickness} onChange={e => setThickness(e.target.value)} type="number"/><small>cm</small></label><label>Surlargeur<select value={overwidth} onChange={e => setOverwidth(e.target.value)}><option>Pleine largeur</option><option>Demi-chaussée</option><option>+ 10 cm</option></select></label></div><div className="check-grid"><label><input type="checkbox"/> Sciage</label><label><input type="checkbox"/> Joints</label><label><input type="checkbox"/> Bouche à clé</label><label><input type="checkbox"/> Circulation</label></div><div className="signature-choice"><b>Signalisation / marquage</b><label><input type="radio" name="sig"/> Faite</label><label><input type="radio" name="sig"/> À faire — <b>Signature</b></label><label><input type="radio" name="sig"/> Non nécessaire</label></div><button className="btn primary" onClick={save}>Enregistrer les mesures</button></Card></div>;
}

function PhotosTab({ os, updateOs }) {
  const set = key => updateOs({ photos: { ...os.photos, [key]: true } });
  const items = [["before", "Avant", true], ["during", "Pendant", false], ["after", "Après", true]];
  return <div><div className="photo-banner"><Camera size={18}/><div><b>Traçabilité photographique</b><span>Avant et Après sont obligatoires pour la validation terrain.</span></div></div><div className="photos-large">{items.map(([key,label,required]) => <div className={`photo-box ${os.photos?.[key] ? "done" : ""}`} key={key}><div className="photo-placeholder"><Camera size={30}/></div><div><b>{label}</b>{required && <span>Obligatoire</span>}</div>{os.photos?.[key] ? <Badge>{"Photo enregistrée"}</Badge> : <button className="btn small" onClick={() => set(key)}>+ Ajouter</button>}</div>)}</div>{!os.photos?.after && <div className="blocking"><AlertTriangle size={17}/><div><b>Validation bloquée</b><span>Ajoutez une photo « Après » pour pouvoir soumettre l'intervention.</span></div></div>}</div>;
}
function DocumentsTab() { return <Card className="empty-module"><FileText size={28}/><h3>Documents du dossier</h3><p>Plans, bons, courriers et pièces du marché seront rattachés directement à l'OS.</p><button className="btn secondary">+ Ajouter un document</button></Card>; }
function HistoryTab({ os }) { return <Card><div className="section-title">Historique de traçabilité</div><div className="timeline"><div><i/><b>Création du dossier</b><span>{formatDateTime(os.createdAt)} · {os.creator}</span></div><div><i/><b>{os.status}</b><span>État actuel du dossier</span></div><div><i/><b>Prochaine action</b><span>{allowedTransitions(os)[0] || "Clôture"}</span></div></div></Card>; }

function CreateOsModal({ onClose, onCreate }) {
  const [type, setType] = useState(DOSSIER_TYPES.EXTERNAL); const [address, setAddress] = useState(""); const [sector, setSector] = useState(""); const [surface, setSurface] = useState(""); const [material, setMaterial] = useState("Enrobé noir");
  return <div className="modal-backdrop"><div className="modal"><div className="modal-head"><div><span className="eyebrow">NOUVEAU DOSSIER</span><h2>Créer un OS</h2></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div><p className="muted">Le numéro OS et la date limite J+25 seront générés automatiquement.</p><div className="type-switch"><button className={type === DOSSIER_TYPES.EXTERNAL ? "active" : ""} onClick={() => setType(DOSSIER_TYPES.EXTERNAL)}>Marché client</button><button className={type === DOSSIER_TYPES.INTERNAL ? "active" : ""} onClick={() => setType(DOSSIER_TYPES.INTERNAL)}>Travail interne Eurovia</button></div><div className="modal-grid"><label>Adresse<input value={address} onChange={e => setAddress(e.target.value)} placeholder="Adresse du chantier"/></label><label>Secteur<input value={sector} onChange={e => setSector(e.target.value)} placeholder="Nord, Centre…"/></label><label>Surface prévue<input value={surface} onChange={e => setSurface(e.target.value)} type="number" placeholder="0"/></label><label>Matériau<select value={material} onChange={e => setMaterial(e.target.value)}><option>Enrobé noir</option><option>Enrobé rouge</option><option>Béton balayé</option><option>Grave-émulsion</option></select></label></div><div className="modal-actions"><button className="btn secondary" onClick={onClose}>Annuler</button><button className="btn primary" onClick={() => onCreate({ type, address, sector, plannedSurface: surface, material })}>Créer l'OS <ArrowRight size={15}/></button></div></div></div>;
}

function MapMock({ osList }) { return <div className="map-mock"><div className="map-lines l1"/><div className="map-lines l2"/><div className="map-lines l3"/>{osList.map((o,i) => <span key={o.id} className="map-pin" style={{left:`${20 + (i * 19) % 65}%`, top:`${30 + (i * 23) % 45}%`, background: DAY_COLORS[o.plannedDay] || "#64748b"}}><Map size={15}/></span>)}<div className="map-caption">Toulouse · interventions opérationnelles</div></div>; }
function ModulePage({ title, go }) { return <><div className="page-head"><div><p className="lead">SETOM V2</p><h2>{title}</h2></div>{title === "Planning" && <button className="btn primary" onClick={() => go("os")}>Voir les OS</button>}</div><Card className="empty-module"><Sparkles size={28}/><h3>Module V2 en construction</h3><p>Le module est réservé à la nouvelle architecture. Il sera branché sur le même dossier OS, sans reprendre l'ancienne logique.</p></Card></>; }
function formatDate(s) { if (!s) return "—"; return new Date(`${s}T12:00:00`).toLocaleDateString("fr-FR"); }
function formatDateTime(s) { if (!s) return "—"; return new Date(s).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }); }
function daysTo(s) { if (!s) return 999; const d = new Date(`${s}T12:00:00`); const n = new Date(); n.setHours(12,0,0,0); return Math.ceil((d-n)/86400000); }

createRoot(document.getElementById("root")).render(<App/>);
