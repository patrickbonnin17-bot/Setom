import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { supabase } from "./supabase";

const days = [
  { name: "Lundi", color: "#1976d2" },
  { name: "Mardi", color: "#2e8b57" },
  { name: "Mercredi", color: "#f39c12" },
  { name: "Jeudi", color: "#8e44ad" },
  { name: "Vendredi", color: "#d32f2f" },
  { name: "Samedi", color: "#16a6a6" },
  { name: "Dimanche", color: "#e83e8c" },
];

const statuses = [
  "Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "Travaux réalisés",
  "Constat à vérifier", "Travaux effectués", "Constat de facturation", "En attente de validation",
  "Validé", "Validé avec réserve", "Réserve", "Correction à réaliser", "Payé", "Archivé", "En erreur", "Doublon", "Annulé",
];

const initialOS = [];

function getDayColor(day) {
  const found = days.find((d) => d.name === day);
  return found ? found.color : "#777";
}

function LocalImagePreview({ file }) {
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => {
    if (!file || !file.type || !file.type.startsWith("image/")) { setPreviewUrl(""); return undefined; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!previewUrl) return null;
  return <img src={previewUrl} alt={file?.name || "Aperçu de la photo"} style={{ width: 88, height: 68, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />;
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [osList, setOsList] = useState([]);
  const [osRefreshVersion, setOsRefreshVersion] = useState(0);
  const [selectedOS, setSelectedOS] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [teamFilter, setTeamFilter] = useState("Toutes");
  const [newOSFiles, setNewOSFiles] = useState([]);
  const [showNewOS, setShowNewOS] = useState(false);
  const [newOSAddress, setNewOSAddress] = useState("");
  const [newOSPostalCode, setNewOSPostalCode] = useState("");
  const [newOSCity, setNewOSCity] = useState("");
  const [newOSMaterial, setNewOSMaterial] = useState("");
  const [newOSMaterialDetail, setNewOSMaterialDetail] = useState("");
  const [newOSSurface, setNewOSSurface] = useState("");
  const [newOSRehabilitationZone, setNewOSRehabilitationZone] = useState("");
  const [newOSRehabilitationOtherDetail, setNewOSRehabilitationOtherDetail] = useState("");
  const [newOSRoadSurface, setNewOSRoadSurface] = useState("");
  const [newOSSidewalkSurface, setNewOSSidewalkSurface] = useState("");
  const [newOSParticularities, setNewOSParticularities] = useState("");
  const [newOSError, setNewOSError] = useState("");
  const [newOSSaving, setNewOSSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setAuthLoading(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => { setSession(newSession); setAuthLoading(false); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const handlePlanningUpdate = () => setOsRefreshVersion((version) => version + 1);
    window.addEventListener("setom:planning-updated", handlePlanningUpdate);
    return () => window.removeEventListener("setom:planning-updated", handlePlanningUpdate);
  }, []);

  useEffect(() => {
    if (!session) { setOsList([]); return; }
    let cancelled = false;
    async function loadOS() {
      const { data: rows, error } = await supabase.from("work_orders").select("*").order("creation_date", { ascending: false });
      if (error) { console.error("Erreur chargement OS :", error); return; }
      const workOrderIds = (rows || []).map((row) => row.id);
      let interventions = [];
      if (workOrderIds.length) {
        const result = await supabase.from("interventions").select("id, work_order_id, team_id, planned_date, planned_order, status").in("work_order_id", workOrderIds);
        if (!result.error) interventions = result.data || []; else console.error("Erreur chargement interventions :", result.error);
      }
      const teamIds = [...new Set(interventions.map((item) => item.team_id).filter(Boolean))];
      let teams = [];
      if (teamIds.length) {
        const result = await supabase.from("teams").select("id, name").in("id", teamIds);
        if (!result.error) teams = result.data || []; else console.error("Erreur chargement équipes :", result.error);
      }
      const teamById = new Map(teams.map((team) => [team.id, team.name]));
      const interventionByOS = new Map();
      for (const item of interventions) {
        if (!interventionByOS.has(item.work_order_id)) interventionByOS.set(item.work_order_id, item);
        else if (!interventionByOS.get(item.work_order_id)?.planned_date && item.planned_date) interventionByOS.set(item.work_order_id, item);
      }
      const formattedOS = (rows || []).map((row) => {
        const intervention = interventionByOS.get(row.id) || null;
        const plannedDate = intervention?.planned_date || null;
        const plannedDay = plannedDate ? new Date(plannedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long" }) : null;
        const day = plannedDay ? plannedDay.charAt(0).toUpperCase() + plannedDay.slice(1) : null;
        return {
          dbId: row.id,
          interventionId: intervention?.id || null,
          id: "OS-" + new Date(row.creation_date).getFullYear() + "-" + String(row.os_number).padStart(5, "0"),
          address: String(row.address || "") + (row.city ? ", " + row.city : ""),
          work: row.material_detail || "Intervention", day, plannedDate,
          team: teamById.get(intervention?.team_id) || "Non affectée", teamId: intervention?.team_id || null,
          trade: row.material_detail || "Intervention", sector: row.city || "", status: row.status || "Nouveau",
          quantity: row.planned_surface_m2 ? String(row.planned_surface_m2) + " m²" : "",
          intervention: row.material_detail || "Intervention", rehabilitationZone: row.rehabilitation_zone,
          rehabilitationOtherDetail: row.rehabilitation_other_detail, roadSurface: row.planned_road_surface_m2,
          sidewalkSurface: row.planned_sidewalk_surface_m2, actualRoadSurface: row.actual_road_surface_m2,
          actualSidewalkSurface: row.actual_sidewalk_surface_m2, actualOtherSurface: row.actual_other_surface_m2,
          deadline: row.deadline_date, isNight: !!row.is_night,
        };
      });
      if (!cancelled) setOsList(formattedOS);
    }
    loadOS().catch((e) => console.error("Erreur inattendue au chargement des OS :", e));
    return () => { cancelled = true; };
  }, [session, osRefreshVersion]);

  async function handleLogin(event) {
    event.preventDefault(); setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError("E-mail ou mot de passe incorrect.");
  }
  async function handleLogout() { await supabase.auth.signOut(); }

  async function handleCreateOS(event) {
    event.preventDefault(); setNewOSError(""); setNewOSSaving(true);
    if (!newOSAddress.trim()) { setNewOSError("L'adresse est obligatoire."); setNewOSSaving(false); return; }
    if (!newOSMaterial) { setNewOSError("Veuillez sélectionner un matériau."); setNewOSSaving(false); return; }
    const parseSurface = (value) => value.trim() === "" ? null : Number(value.replace(",", "."));
    const genericSurface = parseSurface(newOSSurface), roadSurface = parseSurface(newOSRoadSurface), sidewalkSurface = parseSurface(newOSSidewalkSurface);
    if ([genericSurface, roadSurface, sidewalkSurface].some((value) => value !== null && isNaN(value))) { setNewOSError("Les surfaces doivent être des nombres."); setNewOSSaving(false); return; }
    if (!newOSRehabilitationZone) { setNewOSError("Veuillez sélectionner la zone de réfection."); setNewOSSaving(false); return; }
    if (newOSRehabilitationZone === "Autre" && !newOSRehabilitationOtherDetail.trim()) { setNewOSError("Veuillez préciser la zone de réfection."); setNewOSSaving(false); return; }
    const surface = newOSRehabilitationZone === "Chaussée" ? roadSurface : newOSRehabilitationZone === "Trottoir" ? sidewalkSurface : newOSRehabilitationZone === "Chaussée + trottoir" ? (roadSurface || 0) + (sidewalkSurface || 0) : genericSurface;
    const { data, error } = await supabase.from("work_orders").insert({
      status: "À planifier", address: newOSAddress.trim(), postal_code: newOSPostalCode.trim() || null, city: newOSCity.trim() || null,
      material_detail: newOSMaterialDetail.trim() || newOSMaterial, rehabilitation_zone: newOSRehabilitationZone,
      rehabilitation_other_detail: newOSRehabilitationOtherDetail.trim() || null, planned_road_surface_m2: roadSurface,
      planned_sidewalk_surface_m2: sidewalkSurface, planned_surface_m2: surface, particularities: newOSParticularities.trim() || null,
      created_by: session.user.id, updated_by: session.user.id,
    }).select("*").single();
    if (error) { console.error("Erreur création OS :", error); setNewOSError("Impossible de créer l'OS : " + error.message); setNewOSSaving(false); return; }
    for (const file of newOSFiles) {
      try {
        const safeFileName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `work-orders/${data.id}/${Date.now()}-${safeFileName}`;
        const { error: uploadError } = await supabase.storage.from("setom-files").upload(storagePath, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const category = file.type.startsWith("image/") ? "photo" : "document";
        const { error: attachmentError } = await supabase.from("attachments").insert({ work_order_id: data.id, category, file_name: file.name, storage_path: storagePath, mime_type: file.type || null, captured_at: new Date().toISOString(), created_by: session.user.id });
        if (attachmentError) throw attachmentError;
      } catch (fileError) {
        console.error("Erreur upload fichier :", file.name, fileError);
        setNewOSError(`L'OS a été créé, mais le fichier "${file.name}" n'a pas pu être enregistré.`); setNewOSSaving(false); return;
      }
    }
    const formattedOS = {
      id: `OS-${new Date(data.creation_date).getFullYear()}-${String(data.os_number).padStart(5, "0")}`, dbId: data.id,
      address: `${data.address || ""}${data.city ? `, ${data.city}` : ""}`, work: data.material_detail || "Intervention", day: null,
      team: "Non affectée", trade: data.material_detail || "Intervention", sector: data.city || "", status: data.status || "À planifier",
      quantity: data.planned_surface_m2 ? `${data.planned_surface_m2} m²` : "", intervention: data.material_detail || "Intervention",
      rehabilitationZone: data.rehabilitation_zone, rehabilitationOtherDetail: data.rehabilitation_other_detail,
      roadSurface: data.planned_road_surface_m2, sidewalkSurface: data.planned_sidewalk_surface_m2,
      actualRoadSurface: data.actual_road_surface_m2, actualSidewalkSurface: data.actual_sidewalk_surface_m2, actualOtherSurface: data.actual_other_surface_m2,
      deadline: data.deadline_date,
    };
    setOsList((current) => [formattedOS, ...current]); setShowNewOS(false);
    setNewOSAddress(""); setNewOSPostalCode(""); setNewOSCity(""); setNewOSMaterial(""); setNewOSMaterialDetail(""); setNewOSSurface("");
    setNewOSRehabilitationZone(""); setNewOSRehabilitationOtherDetail(""); setNewOSRoadSurface(""); setNewOSSidewalkSurface(""); setNewOSParticularities(""); setNewOSFiles([]); setNewOSError(""); setNewOSSaving(false);
  }

  if (authLoading) return <div style={{ padding: "40px", textAlign: "center" }}><h1>SETOM</h1><p>Chargement...</p></div>;
  if (!session) return <div style={{ padding: "40px", maxWidth: "400px", margin: "auto" }}><h1>SETOM</h1><p>Connexion à votre espace de gestion</p><form onSubmit={handleLogin}><input type="email" placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "10px", boxSizing: "border-box" }} /><input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "10px", boxSizing: "border-box" }} />{authError && <p style={{ color: "red" }}>{authError}</p>}<button type="submit">Se connecter</button></form></div>;

  const filteredOS = osList.filter((os) => {
    const text = `${os.id} ${os.address} ${os.work} ${os.sector}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (statusFilter === "Tous" || os.status === statusFilter) && (teamFilter === "Toutes" || os.team === teamFilter);
  });
  const teams = [...new Set(osList.map((os) => os.team))];
  function updateOS(id, changes) {
    setOsList((current) => current.map((os) => os.id === id ? { ...os, ...changes } : os));
    setSelectedOS((current) => current && current.id === id ? { ...current, ...changes } : current);
  }
  const activeStatuses = new Set(["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "Travaux réalisés", "Constat à vérifier", "Constat validé", "Travaux effectués", "Constat de facturation", "En attente de validation", "Validé", "Validé avec réserve", "Réserve", "Correction à réaliser", "Payé"]);
  const currentWeekday = new Date().toLocaleDateString("fr-FR", { weekday: "long" });
  const currentDayName = currentWeekday.charAt(0).toUpperCase() + currentWeekday.slice(1);
  const stats = {
    total: osList.filter((o) => activeStatuses.has(o.status)).length,
    planning: osList.filter((o) => o.status === "À planifier").length,
    today: osList.filter((o) => o.day === currentDayName).length,
    travaux: osList.filter((o) => o.status === "En travaux" || o.status === "Travaux en cours" || o.status === "Travaux réalisés").length,
    facturation: osList.filter((o) => o.status === "Travaux effectués" || o.status === "Constat de facturation").length,
    validation: osList.filter((o) => o.status === "En attente de validation" || o.status === "Constat à vérifier" || o.status === "Constat validé").length,
    reserves: osList.filter((o) => o.status === "Réserve" || o.status === "Validé avec réserve" || o.status === "Correction à réaliser").length,
  };

  return <div className="app">
    <header className="header"><div><h1>SETOM</h1><small>Gestion des travaux routiers</small></div><div><small>Marché Eau de Toulouse</small></div></header>
    <main className="container">
      <nav className="nav">
        {[["dashboard","📊 Tableau de bord"],["os","📋 OS"],["map","🗺️ Carte"],["planning","📅 Planning"],["teams","👷 Équipes"],["reserves","⚠️ Réserves"]].map(([id,label]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}>{label}</button>)}
      </nav>
      {page === "dashboard" && <><h2>Tableau de bord</h2><div className="cards"><div className="card"><div>OS actifs</div><div className="number">{stats.total}</div></div><div className="card"><div>À planifier</div><div className="number">{stats.planning}</div></div><div className="card"><div>Travaux en cours</div><div className="number">{stats.travaux}</div></div><div className="card"><div>À facturer</div><div className="number">{stats.facturation}</div></div><div className="card"><div>Validation</div><div className="number">{stats.validation}</div></div><div className="card"><div>Réserves</div><div className="number">{stats.reserves}</div></div></div><h2>OS récents</h2><div className="os-list">{osList.slice(0,5).map((os) => <OSCard key={os.id} os={os} onOpen={() => setSelectedOS(os)} />)}</div></>}
      {page === "os" && <>
        {showNewOS && <div className="modal-overlay"><div className="modal"><div className="modal-header"><h2>Nouvel ordre de service</h2><button className="secondary" type="button" onClick={() => setShowNewOS(false)}>✕</button></div><form onSubmit={handleCreateOS}>
          <label>Adresse *</label><input type="text" value={newOSAddress} onChange={(e) => setNewOSAddress(e.target.value)} placeholder="Ex. 12 rue de la République" required />
          <label>Code postal</label><input type="text" value={newOSPostalCode} onChange={(e) => setNewOSPostalCode(e.target.value)} placeholder="Ex. 82000" />
          <label>Ville</label><input type="text" value={newOSCity} onChange={(e) => setNewOSCity(e.target.value)} placeholder="Ex. Montauban" />
          <div className="material-section"><label>Matériau *</label><div className="material-cards">{[{value:"Béton",icon:"🧱"},{value:"Enrobé",icon:"🛣️"},{value:"GE calcaire",icon:"⛰️"},{value:"Asphalte",icon:"⬛"}].map((material) => <button key={material.value} type="button" className={`material-card ${newOSMaterial === material.value ? "selected" : ""}`} onClick={() => {setNewOSMaterial(material.value);setNewOSMaterialDetail("");}}><span className="material-icon">{material.icon}</span><span>{material.value}</span></button>)}</div></div>
          {newOSMaterial === "Béton" && <div className="material-subtypes"><label>Type de béton</label><div className="material-subtype-grid">{["Béton balayé","Béton taloché","Sous-dallage","Béton désactivé","Béton coloré"].map((type) => <button key={type} type="button" className={`material-subtype-button ${newOSMaterialDetail === type ? "selected" : ""}`} onClick={() => setNewOSMaterialDetail(type)}>{type}</button>)}</div></div>}
          {newOSMaterial === "Enrobé" && <div className="material-subtypes"><label>Type d'enrobé</label><div className="material-subtype-grid">{["Enrobé noir","Enrobé rouge","Enrobé miel","Enrobé autre","Enrobé grenaillé"].map((type) => <button key={type} type="button" className={`material-subtype-button ${newOSMaterialDetail === type ? "selected" : ""}`} onClick={() => setNewOSMaterialDetail(type)}>{type}</button>)}</div></div>}
          <label>Détail du matériau</label><input type="text" value={newOSMaterialDetail} onChange={(e) => setNewOSMaterialDetail(e.target.value)} placeholder="Ex. Enrobé 0/10 noir" />
          <div className="rehabilitation-section"><label>Zone de réfection *</label><div className="rehabilitation-cards">{["Chaussée","Trottoir","Chaussée + trottoir","Autre"].map((zone) => <button key={zone} type="button" className={`rehabilitation-card ${newOSRehabilitationZone === zone ? "selected" : ""}`} onClick={() => {setNewOSRehabilitationZone(zone);if(zone!=="Autre")setNewOSRehabilitationOtherDetail("");if(zone==="Chaussée")setNewOSSidewalkSurface("");if(zone==="Trottoir")setNewOSRoadSurface("");}}>{zone}</button>)}</div>
            {newOSRehabilitationZone === "Chaussée" && <div className="rehabilitation-surface-field"><label>Surface chaussée prévue (m²)</label><input type="number" step="0.01" min="0" value={newOSRoadSurface} onChange={(e) => setNewOSRoadSurface(e.target.value)} placeholder="Ex. 12.5" /></div>}
            {newOSRehabilitationZone === "Trottoir" && <div className="rehabilitation-surface-field"><label>Surface trottoir prévue (m²)</label><input type="number" step="0.01" min="0" value={newOSSidewalkSurface} onChange={(e) => setNewOSSidewalkSurface(e.target.value)} placeholder="Ex. 8.5" /></div>}
            {newOSRehabilitationZone === "Chaussée + trottoir" && <div className="rehabilitation-surface-grid"><div><label>Surface chaussée (m²)</label><input type="number" step="0.01" min="0" value={newOSRoadSurface} onChange={(e) => setNewOSRoadSurface(e.target.value)} placeholder="Ex. 12.5" /></div><div><label>Surface trottoir (m²)</label><input type="number" step="0.01" min="0" value={newOSSidewalkSurface} onChange={(e) => setNewOSSidewalkSurface(e.target.value)} placeholder="Ex. 6.5" /></div></div>}
            {newOSRehabilitationZone === "Autre" && <><label>Précision</label><input type="text" value={newOSRehabilitationOtherDetail} onChange={(e) => setNewOSRehabilitationOtherDetail(e.target.value)} placeholder="Préciser la zone de réfection" /><label>Surface prévue (m²)</label><input type="number" step="0.01" min="0" value={newOSSurface} onChange={(e) => setNewOSSurface(e.target.value)} placeholder="Ex. 12.5" /></>}
          </div>
          <label>Particularités</label><textarea value={newOSParticularities} onChange={(e) => setNewOSParticularities(e.target.value)} placeholder="Informations particulières concernant l'intervention..." rows="4" />
          <div className="attachments-section"><label>📎 Photos et documents</label><div className="attachments-buttons"><label className="attachment-button">📷 Prendre une photo<input type="file" accept="image/*" capture="environment" multiple onChange={(e) => {const files=Array.from(e.target.files||[]).filter((file)=>file.type.startsWith("image/"));setNewOSFiles((current)=>[...current,...files]);e.target.value="";}} /></label><label className="attachment-button">🖼️ Choisir une image dans Photos ou Fichiers<input type="file" accept="image/*" multiple onChange={(e) => {const files=Array.from(e.target.files||[]).filter((file)=>file.type.startsWith("image/"));setNewOSFiles((current)=>[...current,...files]);e.target.value="";}} /></label><label className="attachment-button">📄 Ajouter un document<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" multiple onChange={(e)=>{const files=Array.from(e.target.files||[]);setNewOSFiles((current)=>[...current,...files]);e.target.value="";}} /></label></div>{newOSFiles.length>0&&<div className="attachments-list">{newOSFiles.map((file,index)=><div className="attachment-item" key={file.name+"-"+index}>{file.type.startsWith("image/")&&<LocalImagePreview file={file}/>}<span>{file.type.startsWith("image/")?"🖼️":"📄"} {file.name}</span><button type="button" aria-label={"Retirer "+file.name} onClick={()=>setNewOSFiles((current)=>current.filter((_,i)=>i!==index))}>×</button></div>)}</div>}</div>
          {newOSError && <p style={{color:"red",marginTop:10}}>{newOSError}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowNewOS(false)}>Annuler</button><button type="submit" className="primary" disabled={newOSSaving}>{newOSSaving?"Enregistrement...":"Créer l'OS"}</button></div>
        </form></div></div>}
        <h2>Ordres de service</h2><div className="toolbar"><button className="primary" onClick={()=>{setNewOSError("");setShowNewOS(true);}}>+ Nouveau OS</button><input placeholder="🔎 Rechercher OS, adresse..." value={search} onChange={(e)=>setSearch(e.target.value)}/><select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option>Tous</option>{statuses.map((status)=><option key={status}>{status}</option>)}</select><select value={teamFilter} onChange={(e)=>setTeamFilter(e.target.value)}><option>Toutes</option>{teams.map((team)=><option key={team}>{team}</option>)}</select></div><div className="os-list">{filteredOS.map((os)=><OSCard key={os.id} os={os} onOpen={()=>setSelectedOS(os)}/>)}</div>
      </>}
      {page === "map" && <><h2>Carte des interventions</h2><div className="toolbar"><button className="secondary">Tous</button><button className="secondary">OS non planifiés</button><button className="secondary">Réserves</button><button className="secondary">À facturer</button></div><div className="map"><div className="map-road"></div>{osList.map((os,index)=>{const positions=[[20,25],[48,18],[72,35],[30,60],[65,68],[82,20]];const [left,top]=positions[index%positions.length];return <button key={os.id} className="marker" title={os.id} onClick={()=>setSelectedOS(os)} style={{left:`${left}%`,top:`${top}%`,background:os.day?getDayColor(os.day):"#777"}}><span>•</span></button>;})}</div><div className="legend">{days.map((day)=><div className="legend-item" key={day.name}><span className="dot" style={{background:day.color}}></span>{day.name}</div>)}<div className="legend-item"><span className="dot" style={{background:"#777"}}></span>Non planifié</div></div></>}
      {page === "planning" && <><h2>Planning hebdomadaire</h2><div className="planning"><div className="week">{days.slice(0,5).map((day)=><div className="day" key={day.name}><div className="day-header" style={{background:day.color}}>{day.name}</div>{osList.filter((os)=>os.day===day.name).map((os)=><div className="planning-os" key={os.id} onClick={()=>setSelectedOS(os)}><strong>{os.id}</strong><br/>{os.address}<br/><small>{os.team}</small></div>)}</div>)}</div></div><h3>OS non planifiés</h3><div className="os-list">{osList.filter((os)=>!os.day).map((os)=><OSCard key={os.id} os={os} onOpen={()=>setSelectedOS(os)}/>)}</div></>}
      {page === "teams" && <><h2>Équipes</h2><div className="cards">{teams.map((team)=>{const count=osList.filter((os)=>os.team===team).length;return <div className="card" key={team}><strong>👷 {team}</strong><div className="number">{count}</div><div>interventions affectées</div></div>;})}</div></>}
      {page === "reserves" && <><h2>Réserves et corrections</h2><div className="os-list">{osList.filter((os)=>os.status==="Réserve"||os.status==="Correction à réaliser").map((os)=><OSCard key={os.id} os={os} onOpen={()=>setSelectedOS(os)}/>)}{osList.filter((os)=>os.status==="Réserve"||os.status==="Correction à réaliser").length===0&&<div className="card">Aucune réserve en cours.</div>}</div></>}
    </main>
    {selectedOS && <OSModal os={selectedOS} onClose={()=>setSelectedOS(null)} onUpdate={updateOS}/>} 
  </div>;
}

function OSCard({ os, onOpen }) {
  return <div className="os" style={{borderLeftColor:os.day?getDayColor(os.day):"#777"}}><div className="os-top"><div><div className="os-number">{os.id}</div><div className="os-info">📍 {os.address}</div></div><span className="badge">{os.status}</span></div><div className="os-info">🔧 {os.work}<br/>👷 {os.team}<br/>📅 {os.day||"Non planifié"}<br/>📐 {os.quantity}</div><div className="os-actions"><button className="primary" onClick={onOpen}>Ouvrir l'OS</button><button className="secondary" onClick={()=>window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(os.address)}`,"_blank")}>🧭 Naviguer</button></div></div>;
}

function OSModal({ os, onClose, onUpdate }) {
  const [day, setDay] = useState(os?.day || "");
  const [plannedDate, setPlannedDate] = useState(os?.plannedDate || "");
  const [status, setStatus] = useState(os?.status || "");
  const [activeTab, setActiveTab] = useState("resume");
  const [planningSaving, setPlanningSaving] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [workPhotoFiles, setWorkPhotoFiles] = useState([]);
  const [workPhotoSaving, setWorkPhotoSaving] = useState(false);
  const [realLength, setRealLength] = useState(""); const [realWidth, setRealWidth] = useState(""); const [realSurface, setRealSurface] = useState("");
  const [roadLength, setRoadLength] = useState(""); const [roadWidth, setRoadWidth] = useState(""); const [sidewalkLength, setSidewalkLength] = useState(""); const [sidewalkWidth, setSidewalkWidth] = useState("");
  const [otherLength, setOtherLength] = useState(""); const [otherWidth, setOtherWidth] = useState(""); const [realRoadSurface, setRealRoadSurface] = useState(""); const [realSidewalkSurface, setRealSidewalkSurface] = useState(""); const [realOtherSurface, setRealOtherSurface] = useState("");
  const [thickness, setThickness] = useState(""); const [sciage, setSciage] = useState(""); const [joints, setJoints] = useState(""); const [boucheAcle, setBoucheAcle] = useState("");
  const [circulationType, setCirculationType] = useState(""); const [circulationHours, setCirculationHours] = useState(""); const [marquageSurface, setMarquageSurface] = useState(""); const [workComment, setWorkComment] = useState("");
  const [constat, setConstat] = useState(null); const [constatLines, setConstatLines] = useState([]); const [constatLoading, setConstatLoading] = useState(false); const [constatEditMode, setConstatEditMode] = useState(false); const [editableConstatLines, setEditableConstatLines] = useState([]); const [constatEditObservations, setConstatEditObservations] = useState(""); const [constatSaving, setConstatSaving] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  useEffect(() => {
    if (!os?.dbId) return; let cancelled = false;
    async function loadConstat() {
      setConstatLoading(true);
      const { data: payload, error: readError } = await supabase.rpc("get_constat_for_work_order", { p_work_order_id: os.dbId });
      if (readError) { console.error("Erreur lecture constat :", readError); if(!cancelled){setConstat(null);setConstatLines([]);setConstatLoading(false);} return; }
      let constatData = payload?.constat || null, linesData = payload?.lines || [];
      if (!constatData && os.status === "Travaux effectués") {
        const { data: authData } = await supabase.auth.getUser(); const userId = authData?.user?.id || null;
        const { error: rpcError } = await supabase.rpc("generate_constat_for_work_order", { p_work_order_id: os.dbId, p_user_id: userId });
        if (!rpcError) { const { data: refreshed, error: refreshError } = await supabase.rpc("get_constat_for_work_order", { p_work_order_id: os.dbId }); if(!refreshError){constatData=refreshed?.constat||null;linesData=refreshed?.lines||[];} } else console.error("Erreur génération constat automatique :", rpcError);
      }
      if(!cancelled){setConstat(constatData);setConstatLines(linesData);setConstatLoading(false);}
    }
    loadConstat(); return ()=>{cancelled=true;};
  }, [os?.dbId, os?.status]);

  useEffect(() => {
    if (!os?.dbId) return;
    async function loadAttachments() {
      setAttachmentsLoading(true);
      const { data, error } = await supabase.from("attachments").select("*").eq("work_order_id", os.dbId).order("created_at", { ascending:false });
      if(error){console.error("Erreur chargement fichiers :",error);setAttachments([]);setAttachmentsLoading(false);return;}
      const filesWithUrls = await Promise.all((data||[]).map(async(file)=>{const {data:signedData,error:signedError}=await supabase.storage.from("setom-files").createSignedUrl(file.storage_path,3600);return {...file,url:signedError?null:(signedData?.signedUrl||null)};}));
      setAttachments(filesWithUrls); setAttachmentsLoading(false);
    }
    loadAttachments();
  }, [os?.dbId]);

  async function savePlanning() {
    if(!os?.dbId)return; setPlanningSaving(true);
    try {
      const {data:authData}=await supabase.auth.getUser(); const userId=authData?.user?.id||null;
      let {data:intervention,error:interventionError}=await supabase.from("interventions").select("id").eq("work_order_id",os.dbId).maybeSingle(); if(interventionError)throw interventionError;
      if(!intervention){const {data:created,error}=await supabase.from("interventions").insert({work_order_id:os.dbId,type:os.intervention||os.work||"Intervention",status:plannedDate?"Planifié":"À planifier",planned_date:plannedDate||null,planned_surface_m2:Number(String(os.quantity||"").replace(" m²","").replace(",","."))||null}).select("id").single();if(error)throw error;intervention=created;}
      else {const {error}=await supabase.from("interventions").update({planned_date:plannedDate||null,status:plannedDate?"Planifié":"À planifier",updated_at:new Date().toISOString()}).eq("id",intervention.id);if(error)throw error;}
      const nextStatus=plannedDate?"Planifié":"À planifier";const {error:woError}=await supabase.from("work_orders").update({status:nextStatus,updated_by:userId}).eq("id",os.dbId);if(woError)throw woError;
      const nextDay=plannedDate?(()=>{const label=new Date(`${plannedDate}T12:00:00`).toLocaleDateString("fr-FR",{weekday:"long"});return label.charAt(0).toUpperCase()+label.slice(1);})():null;
      onUpdate(os.id,{day:nextDay,plannedDate:plannedDate||null,status:nextStatus,interventionId:intervention.id});setStatus(nextStatus);setDay(nextDay||"");alert(plannedDate?"✅ Planning enregistré.":"✅ OS retiré du planning.");
    }catch(error){console.error("Erreur planning :",error);alert("Impossible d'enregistrer le planning :\n\n"+(error?.message||"Erreur inconnue"));}finally{setPlanningSaving(false);}
  }

  async function uploadWorkPhotos(interventionId=os?.interventionId||null,showSuccess=true){
    if(!os?.dbId||workPhotoFiles.length===0)return true; setWorkPhotoSaving(true); const uploadedAttachments=[];
    try { const {data:authData,error:authError}=await supabase.auth.getUser(); const user=authData?.user;if(authError||!user)throw new Error("Utilisateur non connecté.");
      for(const file of workPhotoFiles){if(!file.type?.startsWith("image/"))throw new Error("Seules les images peuvent être ajoutées comme photos des travaux réalisés.");const safeFileName=file.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_");const storagePath="work-orders/"+os.dbId+"/travaux-realises/"+Date.now()+"-"+safeFileName;const {error:uploadError}=await supabase.storage.from("setom-files").upload(storagePath,file,{cacheControl:"3600",upsert:false});if(uploadError)throw uploadError;const {data:attachment,error:attachmentError}=await supabase.from("attachments").insert({work_order_id:os.dbId,intervention_id:interventionId||null,category:"travaux_realises",file_name:file.name,storage_path:storagePath,mime_type:file.type||null,captured_at:new Date().toISOString(),created_by:user.id}).select("*").single();if(attachmentError){await supabase.storage.from("setom-files").remove([storagePath]);throw attachmentError;}const {data:signedData,error:signedError}=await supabase.storage.from("setom-files").createSignedUrl(storagePath,3600);uploadedAttachments.push({...attachment,url:signedError?null:(signedData?.signedUrl||null)});}
      setAttachments((current)=>[...uploadedAttachments,...current]);setWorkPhotoFiles([]);if(showSuccess)alert("✅ Photos des travaux enregistrées.");return true;
    }catch(error){console.error("Erreur enregistrement photos des travaux :",error);alert("Impossible d'enregistrer les photos des travaux :\n\n"+(error?.message||"Erreur inconnue"));return false;}finally{setWorkPhotoSaving(false);}
  }

  async function save() {
    if(["À planifier","Nouveau"].includes(os?.status)){alert("Cet OS n'est pas encore planifié. Enregistrez d'abord une date dans l'onglet Planning.");setActiveTab("planning");return;}
    if(["Constat à vérifier","Constat validé","Travaux effectués","Payé","Archivé"].includes(os?.status)){setActiveTab("constat");alert("Les travaux ont déjà été transmis pour cet OS. Vérifiez le constat, puis validez-le depuis l'onglet Constat.");return;}
    if(!["Planifié","Travaux en cours","Travaux réalisés"].includes(os?.status)){alert("Le statut actuel de cet OS ne permet pas de transmettre les travaux : "+(os?.status||"non renseigné")+".");return;}
    try {
      const {data:authData,error:userError}=await supabase.auth.getUser();const user=authData?.user;if(userError||!user)throw new Error("Utilisateur non connecté.");
      let {data:intervention,error:interventionError}=await supabase.from("interventions").select("id, work_order_id, type, status, planned_surface_m2, actual_surface_m2").eq("work_order_id",os.dbId).maybeSingle();if(interventionError)throw new Error("Impossible de retrouver l'intervention : "+interventionError.message);
      if(!intervention){const {data:newIntervention,error:createInterventionError}=await supabase.from("interventions").insert({work_order_id:os.dbId,type:os.intervention||os.work||"Intervention",status:"Travaux en cours",planned_surface_m2:os.quantity&&parseFloat(os.quantity)?parseFloat(os.quantity):null,planned_date:os.plannedDate||null,actual_surface_m2:null}).select("*").single();if(createInterventionError)throw new Error("Impossible de créer l'intervention : "+createInterventionError.message);intervention=newIntervention;}
      const roadActual=realRoadSurface!==""&&!isNaN(Number(realRoadSurface))?Number(realRoadSurface):0,sidewalkActual=realSidewalkSurface!==""&&!isNaN(Number(realSidewalkSurface))?Number(realSidewalkSurface):0,otherActual=realOtherSurface!==""&&!isNaN(Number(realOtherSurface))?Number(realOtherSurface):0,genericActual=realSurface!==""&&!isNaN(Number(realSurface))?Number(realSurface):0;
      const totalActualSurface=os.rehabilitationZone==="Chaussée + trottoir"?roadActual+sidewalkActual:os.rehabilitationZone==="Chaussée"?roadActual:os.rehabilitationZone==="Trottoir"?sidewalkActual:os.rehabilitationZone==="Autre"?otherActual:genericActual;
      const plannedSurface=Number(os.quantity?.replace(" m²","").replace(",","."))||0,automaticDemolition=Math.max(0,totalActualSurface-plannedSurface),realizations=[];
      if(totalActualSurface>0)realizations.push({intervention_id:intervention.id,designation:os.intervention||os.work||"Travaux réalisés",quantity:totalActualSurface,unit:"m²",surface_m2:totalActualSurface,thickness_cm:thickness!==""&&!isNaN(Number(thickness))?Number(thickness):null,observations:workComment||null});
      if(sciage!==""&&!isNaN(Number(sciage)))realizations.push({intervention_id:intervention.id,designation:"Sciage",quantity:Number(sciage),unit:"ml",length_ml:Number(sciage)});
      if(joints!==""&&!isNaN(Number(joints)))realizations.push({intervention_id:intervention.id,designation:"Joints",quantity:Number(joints),unit:"ml",length_ml:Number(joints)});
      if(boucheAcle!==""&&!isNaN(Number(boucheAcle)))realizations.push({intervention_id:intervention.id,designation:"Bouché à clé",quantity:Number(boucheAcle),unit:"U"});
      if(automaticDemolition>0)realizations.push({intervention_id:intervention.id,designation:"Démolition",quantity:automaticDemolition,unit:"m²",surface_m2:automaticDemolition});
      if(circulationType&&circulationHours!==""&&!isNaN(Number(circulationHours))&&Number(circulationHours)>0){const designation=circulationType==="K10"?"Circulation alternée manuelle par 2 agents munis de panneaux K10":"Circulation alternée par 2 feux tricolores à batterie synchronisés, y compris la présignalisation, l'entretien et la surveillance des feux";realizations.push({intervention_id:intervention.id,designation,quantity:Number(circulationHours)/4,unit:"1/2 j",observations:Number(circulationHours)+" h"});}
      if(marquageSurface!==""&&!isNaN(Number(marquageSurface))&&Number(marquageSurface)>0)realizations.push({intervention_id:intervention.id,designation:"Marquage",quantity:Number(marquageSurface),unit:"m²",surface_m2:Number(marquageSurface)});
      const {error:deleteRealizationsError}=await supabase.from("work_realizations").delete().eq("intervention_id",intervention.id);if(deleteRealizationsError)throw new Error("Erreur lors du remplacement des travaux réalisés : "+deleteRealizationsError.message);
      if(realizations.length>0){const {error:realizationError}=await supabase.from("work_realizations").insert(realizations);if(realizationError)throw new Error("Erreur lors de l'enregistrement des travaux réalisés : "+realizationError.message);}
      if(workPhotoFiles.length===0&&!attachments.some((file)=>file.category==="travaux_realises"&&file.mime_type?.startsWith("image/"))){alert("Transmission impossible : ajoutez au moins une photo des travaux réalisés.");return;}
      const photosSaved=await uploadWorkPhotos(intervention.id,false);if(!photosSaved)return;
      const {error:workOrderError}=await supabase.from("work_orders").update({actual_road_surface_m2:os.rehabilitationZone==="Chaussée"||os.rehabilitationZone==="Chaussée + trottoir"?(roadActual||null):null,actual_sidewalk_surface_m2:os.rehabilitationZone==="Trottoir"||os.rehabilitationZone==="Chaussée + trottoir"?(sidewalkActual||null):null,actual_other_surface_m2:os.rehabilitationZone==="Autre"?(otherActual||null):null,updated_by:user.id}).eq("id",os.dbId);if(workOrderError)throw new Error("Impossible d'enregistrer les surfaces de l'OS : "+workOrderError.message);
      const {error:prepareInterventionError}=await supabase.from("interventions").update({status:"Travaux en cours",actual_surface_m2:totalActualSurface>0?totalActualSurface:null}).eq("id",intervention.id);if(prepareInterventionError)throw new Error("Impossible de préparer la transmission des travaux : "+prepareInterventionError.message);
      const {error:updateInterventionError}=await supabase.from("interventions").update({status:"Travaux effectués",actual_date:new Date().toISOString().slice(0,10),actual_surface_m2:totalActualSurface>0?totalActualSurface:null}).eq("id",intervention.id);if(updateInterventionError)throw new Error("Impossible de transmettre les travaux : "+updateInterventionError.message);
      const {data:refreshedOS,error:refreshError}=await supabase.from("work_orders").select("status,actual_road_surface_m2,actual_sidewalk_surface_m2,actual_other_surface_m2").eq("id",os.dbId).single();if(refreshError)throw new Error("Les travaux ont été transmis, mais l'OS n'a pas pu être relu : "+refreshError.message);
      const {data:constatPayload,error:constatReadError}=await supabase.rpc("get_constat_for_work_order",{p_work_order_id:os.dbId});if(!constatReadError){setConstat(constatPayload?.constat||null);setConstatLines(constatPayload?.lines||[]);}else console.error("Constat transmis mais lecture impossible :",constatReadError);
      const finalStatus=refreshedOS?.status||"Constat à vérifier";onUpdate(os.id,{day:os.day||null,plannedDate:os.plannedDate||null,status:finalStatus,actualRoadSurface:refreshedOS?.actual_road_surface_m2??(roadActual||null),actualSidewalkSurface:refreshedOS?.actual_sidewalk_surface_m2??(sidewalkActual||null),actualOtherSurface:refreshedOS?.actual_other_surface_m2??(otherActual||null),interventionId:intervention.id});setActiveTab("constat");alert(finalStatus==="Constat à vérifier"?"✅ Travaux transmis. Le constat automatique est prêt à être vérifié.":"✅ Travaux enregistrés. Statut actuel de l'OS : "+finalStatus+".");
    }catch(error){console.error("Erreur générale lors de la transmission des travaux :",error);alert("Erreur lors de l'enregistrement :\n\n"+(error?.message||"Erreur inconnue")+(error?.details?"\n\nDétails : "+error.details:"")+(error?.hint?"\n\nAide : "+error.hint:""));}
  }

  const constatLocked=["Validé","Validé avec réserve","Payé","Archivé"].includes(constat?.status);
  const travauxPhotos=attachments.filter((file)=>file.category==="travaux_realises"&&file.mime_type?.startsWith("image/")&&file.url);

  function startConstatEdit(){if(!constat||constatLocked)return;setEditableConstatLines((constatLines||[]).map((line)=>({id:line.id,bpu_line_id:line.bpu_line_id||"",designation:line.designation||"",quantity:line.quantity??0,unit:line.unit||"",unit_price:line.unit_price??0,amount:line.amount??0,thickness_cm:line.thickness_cm??"",observations:line.observations||"",actual_quantity:line.actual_quantity??"",billing_coefficient:line.billing_coefficient??"",reference_thickness_cm:line.reference_thickness_cm??"",actual_thickness_cm:line.actual_thickness_cm??""})));setConstatEditObservations(constat.observations||"");setConstatEditMode(true);}
  function updateEditableConstatLine(index,field,value){setEditableConstatLines((current)=>current.map((line,i)=>{if(i!==index)return line;const next={...line,[field]:value};if(field==="quantity"||field==="unit_price"){next.amount=((Number(next.quantity)||0)*(Number(next.unit_price)||0)).toFixed(2);}return next;}));}
  function addEditableConstatLine(){setEditableConstatLines((current)=>[...current,{id:`new-${Date.now()}-${current.length}`,bpu_line_id:"",designation:"",quantity:0,unit:"",unit_price:0,amount:0,thickness_cm:"",observations:"",actual_quantity:"",billing_coefficient:"",reference_thickness_cm:"",actual_thickness_cm:""}]);}
  function removeEditableConstatLine(index){setEditableConstatLines((current)=>current.filter((_,i)=>i!==index));}
  async function saveConstatManual(){if(!constat||constatLocked)return;setConstatSaving(true);try{const cleanLines=editableConstatLines.map((line)=>({bpu_line_id:line.bpu_line_id||"",designation:String(line.designation||"").trim()||"Prestation",quantity:Number(line.quantity)||0,unit:String(line.unit||"").trim(),unit_price:Number(line.unit_price)||0,thickness_cm:line.thickness_cm===""?"":Number(line.thickness_cm),observations:line.observations||"",actual_quantity:line.actual_quantity===""?"":Number(line.actual_quantity),billing_coefficient:line.billing_coefficient===""?"":Number(line.billing_coefficient),reference_thickness_cm:line.reference_thickness_cm===""?"":Number(line.reference_thickness_cm),actual_thickness_cm:line.actual_thickness_cm===""?"":Number(line.actual_thickness_cm)}));const {data,error}=await supabase.rpc("update_constat_manual",{p_work_order_id:os.dbId,p_constat_id:constat.id,p_observations:constatEditObservations||null,p_lines:cleanLines});if(error)throw error;setConstat(data?.constat||null);setConstatLines(data?.lines||[]);setConstatEditMode(false);alert("✅ Constat modifié manuellement.");}catch(error){console.error("Erreur modification constat :",error);alert("Impossible d'enregistrer le constat :\n\n"+(error?.message||"Erreur inconnue"));}finally{setConstatSaving(false);}}

  async function validateConstat(){
    if(!constat||constatLocked||constatEditMode||constatSaving)return;
    if(!["Brouillon","À vérifier","À valider"].includes(constat.status||"Brouillon")){
      alert("Le statut actuel du constat ne permet pas cette validation : "+(constat.status||"inconnu")+".");
      return;
    }
    if(!os?.dbId){alert("Impossible d'identifier l'OS associé au constat.");return;}
    const {data:authData,error:authError}=await supabase.auth.getUser();
    const user=authData?.user;
    if(authError||!user){alert("Connexion requise pour valider le constat.");return;}
    if(!window.confirm("Valider ce constat de facturation ? L'OS passera automatiquement à « Travaux effectués »."))return;
    setConstatSaving(true);
    try {
      const {data:result,error:validationError}=await supabase.rpc("validate_constat_for_work_order",{
        p_work_order_id:os.dbId,
        p_constat_id:constat.id,
        p_user_id:user.id
      });
      if(validationError)throw validationError;
      if(result?.constat_status!=="Validé")throw new Error("La base de données n'a pas confirmé la validation du constat.");

      const {data:refreshedPayload,error:constatReadError}=await supabase.rpc("get_constat_for_work_order",{p_work_order_id:os.dbId});
      if(!constatReadError&&refreshedPayload?.constat){
        setConstat(refreshedPayload.constat);
        setConstatLines(refreshedPayload.lines||[]);
      }else{
        if(constatReadError)console.error("Constat validé mais relecture impossible :",constatReadError);
        setConstat({...constat,status:"Validé",validated_at:new Date().toISOString(),validated_by:user.id});
      }

      let finalStatus=result?.work_order_status||null;
      if(!finalStatus){
        const {data:refreshedOS,error:refreshError}=await supabase.from("work_orders").select("status").eq("id",os.dbId).single();
        if(refreshError)console.error("Constat validé mais statut OS impossible à relire :",refreshError);
        finalStatus=refreshedOS?.status||"Constat validé";
      }
      onUpdate(os.id,{status:finalStatus});
      alert(finalStatus==="Travaux effectués"?"✅ Constat validé. L'OS est automatiquement passé à « Travaux effectués ».":"Constat validé. Le statut actuel de l'OS est : "+finalStatus+".");
    }catch(error){
      console.error("Erreur validation du constat :",error);
      alert("Impossible de valider le constat :\\n\\n"+(error?.message||"Erreur inconnue")+(error?.details?"\\n\\nDétails : "+error.details:"")+(error?.hint?"\\n\\nAide : "+error.hint:""));
    }finally{setConstatSaving(false);}
  }

  async function regenerateConstatFromWorks(){if(!constat||constatLocked)return;if(!window.confirm("Recalculer le constat à partir des travaux réalisés ?\n\nLes modifications manuelles actuellement présentes dans le constat seront remplacées."))return;const {data:authData}=await supabase.auth.getUser();const userId=authData?.user?.id||null;const {error}=await supabase.rpc("generate_constat_for_work_order",{p_work_order_id:os.dbId,p_user_id:userId});if(error){alert("Impossible de recalculer le constat :\n\n"+error.message);return;}const {data:refreshed,error:refreshError}=await supabase.rpc("get_constat_for_work_order",{p_work_order_id:os.dbId});if(refreshError){alert("Le recalcul est terminé mais le constat n'a pas pu être relu.");return;}setConstat(refreshed?.constat||null);setConstatLines(refreshed?.lines||[]);setConstatEditMode(false);alert("✅ Constat recalculé depuis les travaux.");}

  const tabs=[{id:"resume",label:"Résumé",icon:"📋"},{id:"travaux",label:"Travaux",icon:"🛠️"},{id:"planning",label:"Planning",icon:"📅"},{id:"photos",label:"Photos",icon:"📷"},{id:"documents",label:"Documents",icon:"📄"},{id:"constat",label:"Constat",icon:"💶"},{id:"historique",label:"Historique",icon:"📜"}];
  const totalSurface= os.rehabilitationZone==="Chaussée + trottoir"?((Number(realRoadSurface)||0)+(Number(realSidewalkSurface)||0)):os.rehabilitationZone==="Chaussée"?(Number(realRoadSurface)||0):os.rehabilitationZone==="Trottoir"?(Number(realSidewalkSurface)||0):os.rehabilitationZone==="Autre"?(Number(realOtherSurface)||0):(Number(realSurface)||0);

  return <div className="modal-bg"><div className="modal os-detail-modal">
    <div className="modal-header"><div><h2>{os.id}</h2><small>{os.address}</small></div><button className="close" onClick={onClose} type="button">×</button></div>
    <div className="os-detail-summary"><div className="os-detail-badge"><span>Zone de réfection</span><strong>{os.rehabilitationZone||"—"}</strong></div>{os.rehabilitationZone==="Autre"&&os.rehabilitationOtherDetail&&<div className="os-detail-badge"><span>Précision</span><strong>{os.rehabilitationOtherDetail}</strong></div>}{os.rehabilitationZone==="Chaussée + trottoir"&&<><div className="os-detail-badge"><span>Chaussée</span><strong>{os.roadSurface!=null?`${os.roadSurface} m²`:"—"}</strong></div><div className="os-detail-badge"><span>Trottoir</span><strong>{os.sidewalkSurface!=null?`${os.sidewalkSurface} m²`:"—"}</strong></div></>}{os.rehabilitationZone==="Chaussée"&&<div className="os-detail-badge"><span>Surface chaussée</span><strong>{os.roadSurface!=null?`${os.roadSurface} m²`:"—"}</strong></div>}{os.rehabilitationZone==="Trottoir"&&<div className="os-detail-badge"><span>Surface trottoir</span><strong>{os.sidewalkSurface!=null?`${os.sidewalkSurface} m²`:"—"}</strong></div>}<div className="os-detail-badge"><span>Statut</span><strong>{os.status||"Nouveau"}</strong></div><div className="os-detail-badge"><span>Matériau</span><strong>{os.work||"—"}</strong></div><div className="os-detail-badge"><span>Surface</span><strong>{os.quantity||"—"}</strong></div><div className="os-detail-badge"><span>Équipe</span><strong>{os.team||"Non affectée"}</strong></div></div>
    <div className="os-tabs">{tabs.map((tab)=><button key={tab.id} type="button" className={activeTab===tab.id?"os-tab active":"os-tab"} onClick={()=>setActiveTab(tab.id)}><span>{tab.icon}</span><span>{tab.label}</span></button>)}</div>
    <div className="os-tab-content">
      {activeTab==="resume"&&<div className="os-section"><h3>Informations générales</h3><div className="os-info-grid"><div><span>Ordre de service</span><strong>{os.id}</strong></div><div><span>Adresse</span><strong>{os.address||"—"}</strong></div><div><span>Matériau</span><strong>{os.work||"—"}</strong></div><div><span>Métier</span><strong>{os.trade||"—"}</strong></div><div><span>Secteur</span><strong>{os.sector||"—"}</strong></div><div><span>Quantité prévue</span><strong>{os.quantity||"—"}</strong></div><div><span>Équipe</span><strong>{os.team||"Non affectée"}</strong></div><div><span>Jour prévu</span><strong>{os.day||"Non planifié"}</strong></div></div><div className="os-status-box"><span>Échéance</span><strong>{os.deadline?new Date(os.deadline).toLocaleDateString("fr-FR"):"—"}</strong></div></div>}
      {activeTab==="travaux"&&<div className="os-section"><h3>Travaux réalisés</h3><div className="os-work-card"><div className="work-summary"><strong>{os.intervention||os.work||"Intervention"}</strong><p>Quantité prévue : <strong>{os.quantity||"Non renseignée"}</strong></p><p>Matériau : <strong>{os.work||"Non renseigné"}</strong></p></div><hr/><h4>Surface réellement réalisée</h4>
        {os.rehabilitationZone==="Chaussée + trottoir"&&<><div className="work-subsection"><strong>Chaussée</strong><div className="work-grid"><div><label>Longueur chaussée (m)</label><input type="number" step="0.01" min="0" value={roadLength} onChange={(e)=>{const value=e.target.value;setRoadLength(value);const l=Number(value),w=Number(roadWidth);setRealRoadSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 4"/></div><div><label>Largeur chaussée (m)</label><input type="number" step="0.01" min="0" value={roadWidth} onChange={(e)=>{const value=e.target.value;setRoadWidth(value);const l=Number(roadLength),w=Number(value);setRealRoadSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 1"/></div></div><div className="work-result"><span>Surface chaussée</span><strong>{realRoadSurface?`${realRoadSurface} m²`:"—"}</strong></div></div><div className="work-subsection"><strong>Trottoir</strong><div className="work-grid"><div><label>Longueur trottoir (m)</label><input type="number" step="0.01" min="0" value={sidewalkLength} onChange={(e)=>{const value=e.target.value;setSidewalkLength(value);const l=Number(value),w=Number(sidewalkWidth);setRealSidewalkSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 2"/></div><div><label>Largeur trottoir (m)</label><input type="number" step="0.01" min="0" value={sidewalkWidth} onChange={(e)=>{const value=e.target.value;setSidewalkWidth(value);const l=Number(sidewalkLength),w=Number(value);setRealSidewalkSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 1"/></div></div><div className="work-result"><span>Surface trottoir</span><strong>{realSidewalkSurface?`${realSidewalkSurface} m²`:"—"}</strong></div></div></>}
        {os.rehabilitationZone==="Chaussée"&&<div className="work-subsection"><strong>Chaussée</strong><div className="work-grid"><div><label>Longueur chaussée (m)</label><input type="number" step="0.01" min="0" value={roadLength} onChange={(e)=>{const value=e.target.value;setRoadLength(value);const l=Number(value),w=Number(roadWidth);setRealRoadSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 5"/></div><div><label>Largeur chaussée (m)</label><input type="number" step="0.01" min="0" value={roadWidth} onChange={(e)=>{const value=e.target.value;setRoadWidth(value);const l=Number(roadLength),w=Number(value);setRealRoadSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 3"/></div></div><div className="work-result"><span>Surface chaussée</span><strong>{realRoadSurface?`${realRoadSurface} m²`:"—"}</strong></div></div>}
        {os.rehabilitationZone==="Trottoir"&&<div className="work-subsection"><strong>Trottoir</strong><div className="work-grid"><div><label>Longueur trottoir (m)</label><input type="number" step="0.01" min="0" value={sidewalkLength} onChange={(e)=>{const value=e.target.value;setSidewalkLength(value);const l=Number(value),w=Number(sidewalkWidth);setRealSidewalkSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 5"/></div><div><label>Largeur trottoir (m)</label><input type="number" step="0.01" min="0" value={sidewalkWidth} onChange={(e)=>{const value=e.target.value;setSidewalkWidth(value);const l=Number(sidewalkLength),w=Number(value);setRealSidewalkSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 2"/></div></div><div className="work-result"><span>Surface trottoir</span><strong>{realSidewalkSurface?`${realSidewalkSurface} m²`:"—"}</strong></div></div>}
        {os.rehabilitationZone==="Autre"&&<div className="work-subsection"><strong>Autre</strong><div className="work-grid"><div><label>Longueur (m)</label><input type="number" step="0.01" min="0" value={otherLength} onChange={(e)=>{const value=e.target.value;setOtherLength(value);const l=Number(value),w=Number(otherWidth);setRealOtherSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 5"/></div><div><label>Largeur (m)</label><input type="number" step="0.01" min="0" value={otherWidth} onChange={(e)=>{const value=e.target.value;setOtherWidth(value);const l=Number(otherLength),w=Number(value);setRealOtherSurface(l>0&&w>0?(l*w).toFixed(2):"");}} placeholder="Ex. 2"/></div></div><div className="work-result"><span>Surface réalisée</span><strong>{realOtherSurface?`${realOtherSurface} m²`:"—"}</strong></div></div>}
        {(!os.rehabilitationZone||!["Chaussée","Trottoir","Chaussée + trottoir","Autre"].includes(os.rehabilitationZone))&&<div className="work-grid"><div><label>Longueur (m)</label><input type="number" step="0.01" value={realLength} onChange={(e)=>{const value=e.target.value;setRealLength(value);const l=Number(value),w=Number(realWidth);if(l>0&&w>0)setRealSurface((l*w).toFixed(2));}} placeholder="Ex. 5"/></div><div><label>Largeur (m)</label><input type="number" step="0.01" value={realWidth} onChange={(e)=>{const value=e.target.value;setRealWidth(value);const l=Number(realLength),w=Number(value);if(l>0&&w>0)setRealSurface((l*w).toFixed(2));}} placeholder="Ex. 3"/></div></div>}
        <div className="work-result"><span>Total surface réellement réalisée</span><strong>{totalSurface>0?`${totalSurface.toFixed(2)} m²`:"—"}</strong></div><h4>Caractéristiques</h4><div className="work-grid"><div><label>Épaisseur (cm)</label><input type="number" step="0.5" value={thickness} onChange={(e)=>setThickness(e.target.value)} placeholder="Ex. 5"/></div><div><label>Sciage (ml)</label><input type="number" step="0.01" value={sciage} onChange={(e)=>setSciage(e.target.value)} placeholder="Ex. 13"/></div><div><label>Joints (ml)</label><input type="number" step="0.01" value={joints} onChange={(e)=>setJoints(e.target.value)} placeholder="Ex. 8"/></div><div><label>Bouché à clé (U)</label><input type="number" step="1" value={boucheAcle} onChange={(e)=>setBoucheAcle(e.target.value)} placeholder="Ex. 1"/></div><div><label>Démolition automatique (m²)</label><input type="number" step="0.01" value={Math.max(0,totalSurface-(Number(os.quantity?.replace(" m²","").replace(",","."))||0)).toFixed(2)} readOnly/></div></div>
        <div className="attachments-section" style={{marginTop:18}}><label>📷 Photos des travaux réalisés — obligatoires pour transmettre les travaux</label><div className="attachments-buttons"><label className="attachment-button">📷 Prendre une photo<input type="file" accept="image/*" capture="environment" multiple onChange={(e)=>{const files=Array.from(e.target.files||[]).filter((file)=>file.type.startsWith("image/"));setWorkPhotoFiles((current)=>[...current,...files]);e.target.value="";}}/></label><label className="attachment-button">🖼️ Choisir une image dans Photos ou Fichiers<input type="file" accept="image/*" multiple onChange={(e)=>{const files=Array.from(e.target.files||[]).filter((file)=>file.type.startsWith("image/"));setWorkPhotoFiles((current)=>[...current,...files]);e.target.value="";}}/></label></div>{workPhotoFiles.length>0&&<div className="attachments-list">{workPhotoFiles.map((file,index)=><div className="attachment-item" key={file.name+"-"+file.lastModified+"-"+index}><LocalImagePreview file={file}/><span>{file.name}</span><button type="button" aria-label={"Retirer "+file.name} onClick={()=>setWorkPhotoFiles((current)=>current.filter((_,i)=>i!==index))}>×</button></div>)}</div>}<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginTop:10}}><button className="secondary" type="button" disabled={workPhotoSaving||workPhotoFiles.length===0} onClick={()=>uploadWorkPhotos(os?.interventionId||null,true)}>{workPhotoSaving?"Enregistrement des photos...":"💾 Enregistrer les photos"}</button><span style={{fontSize:13,color:"#555"}}>Photos enregistrées : {travauxPhotos.length}</span></div></div>
        <h4>Autres travaux</h4><div className="work-grid"><div><label>Circulation</label><select value={circulationType} onChange={(e)=>setCirculationType(e.target.value)}><option value="">Non renseignée</option><option value="K10">2 agents avec panneaux K10</option><option value="FEUX">2 feux tricolores à batterie</option></select>{circulationType&&<input type="number" min="0" step="0.5" value={circulationHours} onChange={(e)=>setCirculationHours(e.target.value)} placeholder="Durée en heures"/>}{circulationHours&&!isNaN(Number(circulationHours))&&<small>{(Number(circulationHours)/4).toFixed(2)} unité(s) de 1/2 journée facturable(s)</small>}</div><div><label>Marquage — surface de peinture (m²)</label><input type="number" min="0" step="0.01" value={marquageSurface} onChange={(e)=>setMarquageSurface(e.target.value)} placeholder="Surface de peinture uniquement"/></div></div><h4>Observations</h4><textarea value={workComment} onChange={(e)=>setWorkComment(e.target.value)} placeholder="Difficultés rencontrées, particularités, complément d'information..." rows="4"/><div className="work-actions"><button className="primary" type="button" onClick={save}>✅ Transmettre les travaux réalisés</button></div>
      </div></div>}
      {activeTab==="planning"&&<div className="os-section"><h3>Planning</h3><div className="os-field"><label>Date d'intervention</label><input type="date" value={plannedDate} onChange={(e)=>setPlannedDate(e.target.value)}/><small>{day?`Jour : ${day}`:"Aucune date planifiée"}</small></div><div className="os-field"><button type="button" className="primary" disabled={planningSaving} onClick={savePlanning}>{planningSaving?"Enregistrement...":"💾 Enregistrer le planning"}</button></div><div className="os-field"><label>Statut OS</label><strong>{status||"—"}</strong></div><div className="os-planning-info"><div><span>Équipe</span><strong>{os.team||"Non affectée"}</strong></div><div><span>Secteur</span><strong>{os.sector||"—"}</strong></div></div></div>}
      {activeTab==="photos"&&<div className="os-section"><h3>Photos</h3>{attachmentsLoading?<div className="os-empty-state">📷<strong>Chargement des photos...</strong></div>:attachments.filter((file)=>file.mime_type?.startsWith("image/")).length===0?<div className="os-empty-state">📷<strong>Aucune photo</strong><span>Aucune photo n'est actuellement associée à cet OS.</span></div>:<div className="os-photo-grid">{attachments.filter((file)=>file.mime_type?.startsWith("image/")&&file.url).map((file)=><div className="os-photo-card" key={file.id}><button type="button" onClick={()=>setPreviewAttachment(file)} style={{border:0,padding:0,background:"transparent",cursor:"pointer"}}><img src={file.url} alt={file.file_name}/></button><div className="os-photo-name">{file.file_name}</div></div>)}</div>}</div>}
      {activeTab==="documents"&&<div className="os-section"><h3>Documents</h3><div className="os-empty-state">📄<strong>Aucun document affiché</strong><span>Les documents associés à cet OS seront affichés ici.</span></div></div>}
      {activeTab==="constat"&&<div className="os-section"><h3>Constat de facturation</h3>
        {constatLoading?<div className="os-empty-state"><strong>Chargement du constat...</strong></div>:!constat?<div className="os-empty-state">💶<strong>Constat non créé</strong><span>Le constat sera créé automatiquement après l'enregistrement des travaux réalisés.</span></div>:<div>
          <div className="os-info-grid"><div><span>Statut</span><strong>{constat.status||"Brouillon"}</strong></div><div><span>Date</span><strong>{constat.constat_date?new Date(constat.constat_date).toLocaleDateString("fr-FR"):"—"}</strong></div><div><span>Total</span><strong>{Number(constat.total_amount||0).toFixed(2)} €</strong></div></div>
          <div style={{margin:"18px 0",padding:16,border:"1px solid #d9e0e7",borderRadius:12,background:"#f8fafc"}}><h4 style={{margin:"0 0 6px"}}>📷 Photos des travaux réalisés</h4><p style={{fontSize:13,color:"#667085",margin:"0 0 12px"}}>Photos déjà enregistrées dans l'onglet Travaux. Aucun nouvel envoi n'est nécessaire pour le constat.</p>{travauxPhotos.length===0?<div style={{fontSize:14,color:"#667085",padding:"8px 0"}}>Aucune photo des travaux réalisés enregistrée pour cet OS.</div>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10}}>{travauxPhotos.map((file)=><button key={file.id} type="button" onClick={()=>setPreviewAttachment(file)} style={{border:"1px solid #d0d5dd",background:"#fff",borderRadius:10,padding:4,cursor:"pointer",textAlign:"left",overflow:"hidden"}}><img src={file.url} alt={file.file_name||"Photo des travaux réalisés"} style={{display:"block",width:"100%",height:110,objectFit:"cover",borderRadius:7}}/><span style={{display:"block",fontSize:11,padding:"5px 3px 2px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:"#475467"}}>{file.file_name||"Photo"}</span></button>)}</div>}</div>
          {!constatLocked&&!constatEditMode&&<div className="os-empty-state" style={{marginTop:16,marginBottom:16}}><strong>Le constat peut être validé après vérification.</strong><button className="primary" type="button" disabled={constatSaving} onClick={validateConstat}>{constatSaving?"Validation...":"✅ Valider le constat"}</button></div>}
          {constatLocked?<div className="os-empty-state" style={{marginTop:16}}>🔒<strong>Constat verrouillé</strong><span>Ce constat ne peut plus être modifié car il est {constat.status?.toLowerCase()}.</span></div>:!constatEditMode?<div style={{display:"flex",gap:10,flexWrap:"wrap",margin:"16px 0"}}><button className="primary" type="button" onClick={startConstatEdit}>✏️ Modifier le constat</button><button className="secondary" type="button" onClick={regenerateConstatFromWorks}>↻ Recalculer depuis les travaux</button></div>:<div style={{margin:"16px 0"}}><div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}><button className="primary" type="button" disabled={constatSaving} onClick={saveConstatManual}>{constatSaving?"Enregistrement...":"💾 Enregistrer les modifications"}</button><button className="secondary" type="button" disabled={constatSaving} onClick={()=>setConstatEditMode(false)}>Annuler</button><button className="secondary" type="button" disabled={constatSaving} onClick={regenerateConstatFromWorks}>↻ Recalculer depuis les travaux</button></div><label>Observations du constat</label><textarea value={constatEditObservations} onChange={(e)=>setConstatEditObservations(e.target.value)} rows="3" placeholder="Observation ou précision de facturation..."/><h4>Détail des prestations — modification manuelle</h4><div style={{overflowX:"auto",border:"1px solid #ddd",borderRadius:10}}><table style={{width:"100%",minWidth:900,borderCollapse:"collapse"}}><thead><tr><th style={{textAlign:"left",padding:8}}>Prestation</th><th style={{padding:8}}>Qté</th><th style={{padding:8}}>Unité</th><th style={{padding:8}}>Prix unitaire</th><th style={{padding:8}}>Montant</th><th style={{padding:8}}>Épaisseur</th><th style={{padding:8}}>Observation</th><th style={{padding:8}}></th></tr></thead><tbody>{editableConstatLines.map((line,index)=><tr key={line.id||index}><td style={{padding:6}}><input style={{width:"100%"}} value={line.designation} onChange={(e)=>updateEditableConstatLine(index,"designation",e.target.value)}/></td><td style={{padding:6}}><input type="number" step="0.01" min="0" style={{width:90}} value={line.quantity} onChange={(e)=>updateEditableConstatLine(index,"quantity",e.target.value)}/></td><td style={{padding:6}}><input style={{width:75}} value={line.unit} onChange={(e)=>updateEditableConstatLine(index,"unit",e.target.value)}/></td><td style={{padding:6}}><input type="number" step="0.01" min="0" style={{width:110}} value={line.unit_price} onChange={(e)=>updateEditableConstatLine(index,"unit_price",e.target.value)}/></td><td style={{padding:6,textAlign:"right",fontWeight:700}}>{(Number(line.quantity)*Number(line.unit_price)).toFixed(2)} €</td><td style={{padding:6}}><input type="number" step="0.1" min="0" style={{width:90}} value={line.thickness_cm} onChange={(e)=>updateEditableConstatLine(index,"thickness_cm",e.target.value)}/></td><td style={{padding:6}}><input style={{width:180}} value={line.observations} onChange={(e)=>updateEditableConstatLine(index,"observations",e.target.value)}/></td><td style={{padding:6}}><button className="secondary" type="button" onClick={()=>removeEditableConstatLine(index)}>✕</button></td></tr>)}</tbody></table></div><button className="secondary" type="button" style={{marginTop:10}} onClick={addEditableConstatLine}>+ Ajouter une prestation</button></div>}
          {!constatEditMode&&<><h4>Détail des prestations</h4>{constatLines.length===0?<div className="os-empty-state"><span>Aucune prestation.</span></div>:constatLines.map((line)=><div className="os-info-grid" key={line.id}><div><span>{line.designation}</span><strong>{Number(line.quantity||0).toFixed(2)} {line.unit||""} × {Number(line.unit_price||0).toFixed(2)} € = {Number(line.amount||0).toFixed(2)} €</strong></div></div>)}{constat.observations&&<div className="os-info-grid" style={{marginTop:10}}><div><span>Observations</span><strong>{constat.observations}</strong></div></div>}</>}
        </div>}
      </div>}
      {activeTab==="historique"&&<div className="os-section"><h3>Historique</h3><div className="os-history"><div className="history-item"><span className="history-dot"/><div><strong>Création de l'OS</strong><small>Historique détaillé disponible après connexion aux données Supabase.</small></div></div></div></div>}
    </div>
    <div className="os-actions"><button className="secondary" type="button" onClick={()=>window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(os.address)}`,"_blank")}>🧭 Itinéraire</button></div>
    {previewAttachment&&<div onClick={(e)=>{if(e.target===e.currentTarget)setPreviewAttachment(null);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:99999,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><img src={previewAttachment.url} alt={previewAttachment.file_name||"Photo"} style={{maxWidth:"95vw",maxHeight:"90vh",objectFit:"contain",borderRadius:10}}/><button type="button" onClick={()=>setPreviewAttachment(null)} style={{position:"fixed",top:18,right:20,width:42,height:42,border:0,borderRadius:"50%",fontSize:30,lineHeight:1,background:"#fff",color:"#111",cursor:"pointer"}}>×</button></div>}
  </div></div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
