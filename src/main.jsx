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
  "Nouveau",
  "Nouvelle intervention",
  "Planifié",
  "En cours de travaux",
  "Travaux à facturer",
  "En attente de validation",
  "Réserve",
  "Correction à réaliser",
  "Validé",
  "Archivé",
  "En erreur",
  "Doublon",
  "Annulé",
];

const initialOS = [
  {
    id: "OS-2026-00125",
    address: "12 rue des Lilas, Toulouse",
    work: "Réfection enrobé",
    day: "Lundi",
    team: "Équipe Enrobé 1",
    trade: "Enrobé",
    sector: "Toulouse Nord",
    status: "Planifié",
    quantity: "8 m²",
    intervention: "Enrobé",
  },
  {
    id: "OS-2026-00126",
    address: "24 avenue Jean Jaurès, Toulouse",
    work: "Réfection chaussée",
    day: "Mardi",
    team: "Équipe Enrobé 2",
    trade: "Enrobé",
    sector: "Toulouse Centre",
    status: "En cours de travaux",
    quantity: "12 m²",
    intervention: "Enrobé",
  },
  {
    id: "OS-2026-00127",
    address: "8 chemin des Vignes, Blagnac",
    work: "Réfection trottoir",
    day: "Mercredi",
    team: "Équipe Asphalte",
    trade: "Asphalte",
    sector: "Blagnac",
    status: "À planifier",
    quantity: "6 m²",
    intervention: "Asphalte",
  },
  {
    id: "OS-2026-00128",
    address: "3 rue Victor Hugo, Colomiers",
    work: "Réfection après fuite",
    day: "Jeudi",
    team: "Équipe Enrobé 1",
    trade: "Enrobé",
    sector: "Colomiers",
    status: "Travaux à facturer",
    quantity: "15 m²",
    intervention: "Enrobé",
  },
  {
    id: "OS-2026-00129",
    address: "17 rue de la République, Toulouse",
    work: "Réfection signalisation",
    day: "Vendredi",
    team: "Équipe Signalisation",
    trade: "Signalisation",
    sector: "Toulouse Centre",
    status: "Réserve",
    quantity: "1 forfait",
    intervention: "Signalisation",
  },
  {
    id: "OS-2026-00130",
    address: "6 rue des Écoles, Tournefeuille",
    work: "Réfection enrobé",
    day: null,
    team: "Équipe Enrobé 2",
    trade: "Enrobé",
    sector: "Tournefeuille",
    status: "Nouveau",
    quantity: "10 m²",
    intervention: "Enrobé",
  },
];

function getDayColor(day) {
  const found = days.find((d) => d.name === day);
  return found ? found.color : "#777";
}

function App() {
 const [page, setPage] = useState("dashboard");

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

     useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setAuthLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    async function loadOS() {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*")
        .order("creation_date", { ascending: false });

      if (error) {
        console.error("Erreur chargement OS :", error);
        return;
      }

      const formattedOS = data.map((row) => ({
        dbId: row.id,
        id: `OS-${new Date(row.creation_date).getFullYear()}-${String(row.os_number).padStart(5, "0")}`,
        address: `${row.address || ""}${row.city ? `, ${row.city}` : ""}`,
        work: row.material_detail || "Intervention",
        day: null,
        team: "Non affectée",
        trade: row.material_detail || "Intervention",
        sector: row.city || "",
        status: row.status || "Nouveau",
        quantity: row.planned_surface_m2
          ? `${row.planned_surface_m2} m²`
          : "",
        intervention: row.material_detail || "Intervention",
        deadline: row.deadline_date,
      }));

      setOsList(formattedOS);
    }

    loadOS();
  }, [session]);
  

  async function handleLogin(event) {
    event.preventDefault();
    setAuthError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthError("E-mail ou mot de passe incorrect.");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }
 async function handleCreateOS(event) {
  event.preventDefault();

  setNewOSError("");
  setNewOSSaving(true);

  if (!newOSAddress.trim()) {
    setNewOSError("L'adresse est obligatoire.");
    setNewOSSaving(false);
    return;
  }

  if (!newOSMaterial) {
    setNewOSError("Veuillez sélectionner un matériau.");
    setNewOSSaving(false);
    return;
  }

  const surface =
    newOSSurface.trim() === ""
      ? null
      : Number(newOSSurface.replace(",", "."));

  if (newOSSurface.trim() !== "" && isNaN(surface)) {
    setNewOSError("La surface doit être un nombre.");
    setNewOSSaving(false);
    return;
  }

  /* =========================
     1. CRÉATION DE L'OS
     ========================= */

  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      status: "À planifier",
      address: newOSAddress.trim(),
      postal_code: newOSPostalCode.trim() || null,
      city: newOSCity.trim() || null,
      material_detail:
        newOSMaterialDetail.trim() || newOSMaterial,
      planned_surface_m2: surface,
      particularities:
        newOSParticularities.trim() || null,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erreur création OS :", error);

    setNewOSError(
      "Impossible de créer l'OS : " + error.message
    );

    setNewOSSaving(false);
    return;
  }

  /* =========================
     2. UPLOAD DES PHOTOS/DOCUMENTS
     ========================= */

  if (newOSFiles.length > 0) {
    for (const file of newOSFiles) {
      try {
        const safeFileName = file.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_");

        const storagePath =
          `work-orders/${data.id}/${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from("setom-files")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        /* =========================
           3. ENREGISTREMENT DU FICHIER
           DANS ATTACHMENTS
           ========================= */

        const category = file.type.startsWith("image/")
          ? "photo"
          : "document";

        const { error: attachmentError } = await supabase
          .from("attachments")
          .insert({
            work_order_id: data.id,
            category,
            file_name: file.name,
            storage_path: storagePath,
            mime_type: file.type || null,
            captured_at: new Date().toISOString(),
            created_by: session.user.id,
          });

        if (attachmentError) {
          throw attachmentError;
        }
      } catch (fileError) {
        console.error(
          "Erreur upload fichier :",
          file.name,
          fileError
        );

        setNewOSError(
          `L'OS a été créé, mais le fichier "${file.name}" n'a pas pu être enregistré.`
        );

        setNewOSSaving(false);
        return;
      }
    }
  }

  /* =========================
     4. AJOUT DE L'OS À L'INTERFACE
     ========================= */

  const formattedOS = {
    id: `OS-${new Date(data.creation_date).getFullYear()}-${String(
      data.os_number
    ).padStart(5, "0")}`,
    dbId: data.id,
    address: `${data.address || ""}${
      data.city ? `, ${data.city}` : ""
    }`,

    work: data.material_detail || "Intervention",

    day: null,

    team: "Non affectée",

    trade: data.material_detail || "Intervention",

    sector: data.city || "",

    status: data.status || "À planifier",

    quantity: data.planned_surface_m2
      ? `${data.planned_surface_m2} m²`
      : "",

    intervention: data.material_detail || "Intervention",

    deadline: data.deadline_date,
  };

  setOsList((current) => [formattedOS, ...current]);

  /* =========================
     5. FERMETURE / RESET DU FORMULAIRE
     ========================= */

  setShowNewOS(false);

  setNewOSAddress("");
  setNewOSPostalCode("");
  setNewOSCity("");
  setNewOSMaterial("");
  setNewOSMaterialDetail("");
  setNewOSSurface("");
  setNewOSParticularities("");
  setNewOSFiles([]);
  setNewOSError("");
  setNewOSSaving(false);
}
  const [osList, setOsList] = useState([]);
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
const [newOSParticularities, setNewOSParticularities] = useState("");
const [newOSError, setNewOSError] = useState("");
const [newOSSaving, setNewOSSaving] = useState(false);
  
  if (authLoading) {
    return <div>Chargement de SETOM...</div>;
  }

  if (!session) {
    return (
      <div style={{ padding: "40px", maxWidth: "400px", margin: "auto" }}>
        <h1>SETOM</h1>
        <p>Connexion à votre espace de gestion</p>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
          />

          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
          />

          {authError && (
            <p style={{ color: "red" }}>{authError}</p>
          )}

          <button type="submit">
            Se connecter
          </button>
        </form>
      </div>
    );
  }


  const filteredOS = osList.filter((os) => {
    const text =
      `${os.id} ${os.address} ${os.work} ${os.sector}`.toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "Tous" || os.status === statusFilter;
    const matchesTeam =
      teamFilter === "Toutes" || os.team === teamFilter;

    return matchesSearch && matchesStatus && matchesTeam;
  });

  const teams = [...new Set(osList.map((os) => os.team))];

  function updateOS(id, changes) {
    setOsList((current) =>
      current.map((os) =>
        os.id === id ? { ...os, ...changes } : os
      )
    );

    setSelectedOS((current) =>
      current && current.id === id
        ? { ...current, ...changes }
        : current
    );
  }

  const stats = {
    total: osList.length,
    planning: osList.filter(
      (o) => o.status === "À planifier"
    ).length,
    today: osList.filter(
      (o) => o.day === "Lundi"
    ).length,
    travaux: osList.filter(
      (o) => o.status === "En cours de travaux"
    ).length,
    facturation: osList.filter(
      (o) => o.status === "Travaux à facturer"
    ).length,
    validation: osList.filter(
      (o) => o.status === "En attente de validation"
    ).length,
    reserves: osList.filter(
      (o) => o.status === "Réserve"
    ).length,
   };

  if (authLoading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>SETOM</h1>
        <p>Chargement...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: "40px", maxWidth: "400px", margin: "auto" }}>
        <h1>SETOM</h1>
        <p>Connexion à votre espace de gestion</p>

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              boxSizing: "border-box"
            }}
          />

          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              boxSizing: "border-box"
            }}
          />

          {authError && (
            <p style={{ color: "red" }}>
              {authError}
            </p>
          )}

          <button type="submit">
            Se connecter
          </button>
        </form>
      </div>
    );
  }


  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>SETOM</h1>
          <small>Gestion des travaux routiers</small>
        </div>

        <div>
          <small>Marché Eau de Toulouse</small>
        </div>
      </header>

      <main className="container">

        <nav className="nav">
          <button
            className={page === "dashboard" ? "active" : ""}
            onClick={() => setPage("dashboard")}
          >
            📊 Tableau de bord
          </button>

          <button
            className={page === "os" ? "active" : ""}
            onClick={() => setPage("os")}
          >
            📋 OS
          </button>

          <button
            className={page === "map" ? "active" : ""}
            onClick={() => setPage("map")}
          >
            🗺️ Carte
          </button>

          <button
            className={page === "planning" ? "active" : ""}
            onClick={() => setPage("planning")}
          >
            📅 Planning
          </button>

          <button
            className={page === "teams" ? "active" : ""}
            onClick={() => setPage("teams")}
          >
            👷 Équipes
          </button>

          <button
            className={page === "reserves" ? "active" : ""}
            onClick={() => setPage("reserves")}
          >
            ⚠️ Réserves
          </button>
        </nav>

        {page === "dashboard" && (
          <>
            <h2>Tableau de bord</h2>

            <div className="cards">

              <div className="card">
                <div>OS actifs</div>
                <div className="number">{stats.total}</div>
              </div>

              <div className="card">
                <div>À planifier</div>
                <div className="number">{stats.planning}</div>
              </div>

              <div className="card">
                <div>Travaux en cours</div>
                <div className="number">{stats.travaux}</div>
              </div>

              <div className="card">
                <div>À facturer</div>
                <div className="number">{stats.facturation}</div>
              </div>

              <div className="card">
                <div>Validation</div>
                <div className="number">{stats.validation}</div>
              </div>

              <div className="card">
                <div>Réserves</div>
                <div className="number">{stats.reserves}</div>
              </div>
            </div>

            <h2>OS récents</h2>

            <div className="os-list">
              {osList.slice(0, 5).map((os) => (
                <OSCard
                  key={os.id}
                  os={os}
                  onOpen={() => setSelectedOS(os)}
                />
              ))}
            </div>
          </>
        )}

        {page === "os" && (
    <>
      {showNewOS && (
  <div className="modal-overlay">
    <div className="modal">
      <div className="modal-header">
        <h2>Nouvel ordre de service</h2>

        <button
          className="secondary"
          type="button"
          onClick={() => setShowNewOS(false)}
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleCreateOS}>

        <label>Adresse *</label>
        <input
          type="text"
          value={newOSAddress}
          onChange={(e) => setNewOSAddress(e.target.value)}
          placeholder="Ex. 12 rue de la République"
          required
        />

        <label>Code postal</label>
        <input
          type="text"
          value={newOSPostalCode}
          onChange={(e) => setNewOSPostalCode(e.target.value)}
          placeholder="Ex. 82000"
        />

        <label>Ville</label>
        <input
          type="text"
          value={newOSCity}
          onChange={(e) => setNewOSCity(e.target.value)}
          placeholder="Ex. Montauban"
        />

        <label>Matériau *</label>
      
        <div className="material-section">
  <label>Matériau *</label>

  <div className="material-cards">
    {[
      { value: "Béton", icon: "🧱" },
      { value: "Enrobé", icon: "🛣️" },
      { value: "GE calcaire", icon: "⛰️" },
      { value: "Asphalte", icon: "⬛" },
    ].map((material) => (
      <button
        key={material.value}
        type="button"
        className={`material-card ${
          newOSMaterial === material.value ? "selected" : ""
        }`}
        onClick={() => {
          setNewOSMaterial(material.value);
          setNewOSMaterialDetail("");
        }}
      >
        <span className="material-icon">
          {material.icon}
        </span>

        <span>{material.value}</span>
      </button>
    ))}
  </div>
</div>
  {newOSMaterial === "Béton" && (
  <div className="material-subtypes">
    <label>Type de béton</label>

    <div className="material-subtype-grid">
      {[
        "Béton balayé",
        "Béton taloché",
        "Sous-dallage",
        "Béton désactivé",
        "Béton coloré",
      ].map((type) => (
        <button
          key={type}
          type="button"
          className={`material-subtype-button ${
            newOSMaterialDetail === type ? "selected" : ""
          }`}
          onClick={() => setNewOSMaterialDetail(type)}
        >
          {type}
        </button>
      ))}
    </div>
  </div>
)}

{newOSMaterial === "Enrobé" && (
  <div className="material-subtypes">
    <label>Type d'enrobé</label>

    <div className="material-subtype-grid">
      {[
        "Enrobé noir",
        "Enrobé rouge",
        "Enrobé miel",
        "Enrobé autre",
        "Enrobé grenaillé",
      ].map((type) => (
        <button
          key={type}
          type="button"
          className={`material-subtype-button ${
            newOSMaterialDetail === type ? "selected" : ""
          }`}
          onClick={() => setNewOSMaterialDetail(type)}
        >
          {type}
        </button>
      ))}
    </div>
  </div>
)}     

        <label>Détail du matériau</label>
        <input
          type="text"
          value={newOSMaterialDetail}
          onChange={(e) => setNewOSMaterialDetail(e.target.value)}
          placeholder="Ex. Enrobé 0/10 noir"
        />

        <label>Surface prévue (m²)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={newOSSurface}
          onChange={(e) => setNewOSSurface(e.target.value)}
          placeholder="Ex. 12.5"
        />

        <label>Particularités</label>
        <textarea
          value={newOSParticularities}
          onChange={(e) => setNewOSParticularities(e.target.value)}
          placeholder="Informations particulières concernant l'intervention..."
          rows="4"
        />
<div className="attachments-section">
  <label>📎 Photos et documents</label>

  <div className="attachments-buttons">
    <label className="attachment-button">
      📷 Ajouter une photo
      <input
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          setNewOSFiles((current) => [...current, ...files]);
          e.target.value = "";
        }}
      />
    </label>

    <label className="attachment-button">
      📄 Ajouter un document
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          setNewOSFiles((current) => [...current, ...files]);
          e.target.value = "";
        }}
      />
    </label>
  </div>

  {newOSFiles.length > 0 && (
    <div className="attachments-list">
      {newOSFiles.map((file, index) => (
        <div className="attachment-item" key={`${file.name}-${index}`}>
          <span>
            {file.type.startsWith("image/") ? "🖼️" : "📄"}{" "}
            {file.name}
          </span>

          <button
            type="button"
            onClick={() => {
              setNewOSFiles((current) =>
                current.filter((_, i) => i !== index)
              );
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )}
</div>
        {newOSError && (
          <p style={{ color: "red", marginTop: "10px" }}>
            {newOSError}
          </p>
        )}

        <div className="modal-actions">

          <button
            type="button"
            className="secondary"
            onClick={() => setShowNewOS(false)}
          >
            Annuler
          </button>

          <button
            type="submit"
            className="primary"
            disabled={newOSSaving}
          >
            {newOSSaving ? "Enregistrement..." : "Créer l'OS"}
          </button>

        </div>

      </form>
    </div>
  </div>
)}
         
            <h2>Ordres de service</h2>

            <div className="toolbar">
<button
  className="primary"
  onClick={() => {
    setNewOSError("");
    setShowNewOS(true);
  }}
>
  + Nouveau OS
</button>
              <input
                placeholder="🔎 Rechercher OS, adresse..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>Tous</option>
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>

              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
              >
                <option>Toutes</option>
                {teams.map((team) => (
                  <option key={team}>{team}</option>
                ))}
              </select>

            </div>

            <div className="os-list">
              {filteredOS.map((os) => (
                <OSCard
                  key={os.id}
                  os={os}
                  onOpen={() => setSelectedOS(os)}
                />
              ))}
            </div>
          </>
        )}

        {page === "map" && (
          <>
            <h2>Carte des interventions</h2>

            <div className="toolbar">
              <button className="secondary">
                Tous
              </button>
              <button className="secondary">
                OS non planifiés
              </button>
              <button className="secondary">
                Réserves
              </button>
              <button className="secondary">
                À facturer
              </button>
            </div>

            <div className="map">
              <div className="map-road"></div>

              {osList.map((os, index) => {
                const positions = [
                  [20, 25],
                  [48, 18],
                  [72, 35],
                  [30, 60],
                  [65, 68],
                  [82, 20],
                ];

                const [left, top] =
                  positions[index % positions.length];

                return (
                  <button
                    key={os.id}
                    className="marker"
                    title={os.id}
                    onClick={() => setSelectedOS(os)}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      background:
                        os.day
                          ? getDayColor(os.day)
                          : "#777",
                    }}
                  >
                    <span>•</span>
                  </button>
                );
              })}
            </div>

            <div className="legend">
              {days.map((day) => (
                <div className="legend-item" key={day.name}>
                  <span
                    className="dot"
                    style={{ background: day.color }}
                  ></span>
                  {day.name}
                </div>
              ))}

              <div className="legend-item">
                <span
                  className="dot"
                  style={{ background: "#777" }}
                ></span>
                Non planifié
              </div>
            </div>
          </>
        )}

        {page === "planning" && (
          <>
            <h2>Planning hebdomadaire</h2>

            <div className="planning">
              <div className="week">

                {days.slice(0, 5).map((day) => (
                  <div className="day" key={day.name}>

                    <div
                      className="day-header"
                      style={{
                        background: day.color,
                      }}
                    >
                      {day.name}
                    </div>

                    {osList
                      .filter((os) => os.day === day.name)
                      .map((os) => (
                        <div
                          className="planning-os"
                          key={os.id}
                          onClick={() => setSelectedOS(os)}
                        >
                          <strong>{os.id}</strong>
                          <br />
                          {os.address}
                          <br />
                          <small>
                            {os.team}
                          </small>
                        </div>
                      ))}

                  </div>
                ))}

              </div>
            </div>

            <h3>OS non planifiés</h3>

            <div className="os-list">
              {osList
                .filter((os) => !os.day)
                .map((os) => (
                  <OSCard
                    key={os.id}
                    os={os}
                    onOpen={() => setSelectedOS(os)}
                  />
                ))}
            </div>
          </>
        )}

        {page === "teams" && (
          <>
            <h2>Équipes</h2>

            <div className="cards">

              {teams.map((team) => {
                const count = osList.filter(
                  (os) => os.team === team
                ).length;

                return (
                  <div className="card" key={team}>
                    <strong>👷 {team}</strong>
                    <div className="number">
                      {count}
                    </div>
                    <div>
                      interventions affectées
                    </div>
                  </div>
                );
              })}

            </div>
          </>
        )}

        {page === "reserves" && (
          <>
            <h2>Réserves et corrections</h2>

            <div className="os-list">
              {osList
                .filter(
                  (os) =>
                    os.status === "Réserve" ||
                    os.status === "Correction à réaliser"
                )
                .map((os) => (
                  <OSCard
                    key={os.id}
                    os={os}
                    onOpen={() => setSelectedOS(os)}
                  />
                ))}

              {osList.filter(
                (os) =>
                  os.status === "Réserve" ||
                  os.status === "Correction à réaliser"
              ).length === 0 && (
                <div className="card">
                  Aucune réserve en cours.
                </div>
              )}
            </div>
          </>
        )}

      </main>

      {selectedOS && (
        <OSModal
          os={selectedOS}
          onClose={() => setSelectedOS(null)}
          onUpdate={updateOS}
        />
      )}
    </div>
  );
}

function OSCard({ os, onOpen }) {
  return (
    <div
      className="os"
      style={{
        borderLeftColor:
          os.day
            ? getDayColor(os.day)
            : "#777",
      }}
    >
      <div className="os-top">

        <div>
          <div className="os-number">
            {os.id}
          </div>

          <div className="os-info">
            📍 {os.address}
          </div>
        </div>

        <span className="badge">
          {os.status}
        </span>

      </div>

      <div className="os-info">
        🔧 {os.work}
        <br />
        👷 {os.team}
        <br />
        📅 {os.day || "Non planifié"}
        <br />
        📐 {os.quantity}
      </div>

      <div className="os-actions">
        <button
          className="primary"
          onClick={onOpen}
        >
          Ouvrir l'OS
        </button>

        <button
          className="secondary"
          onClick={() =>
            window.open(
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                os.address
              )}`,
              "_blank"
            )
          }
        >
          🧭 Naviguer
        </button>
      </div>
    </div>
  );
}

function OSModal({ os, onClose, onUpdate }) {
  const [day, setDay] = useState(os?.day || "");
  const [status, setStatus] = useState(os?.status || "");
  const [activeTab, setActiveTab] = useState("resume");
const [attachments, setAttachments] = useState([]);
const [attachmentsLoading, setAttachmentsLoading] = useState(false);
 const [realLength, setRealLength] = useState("");
const [realWidth, setRealWidth] = useState("");
const [realSurface, setRealSurface] = useState("");
const [thickness, setThickness] = useState("");
const [sciage, setSciage] = useState("");
const [joints, setJoints] = useState("");
const [boucheAcle, setBoucheAcle] = useState("");
const [demolition, setDemolition] = useState("");
const [circulation, setCirculation] = useState("");
const [marquage, setMarquage] = useState("");
const [workComment, setWorkComment] = useState(""); 
 useEffect(() => {
  if (!os?.dbId) return;

  async function loadAttachments() {
    setAttachmentsLoading(true);

    const { data, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("work_order_id", os.dbId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement fichiers :", error);
      setAttachments([]);
      setAttachmentsLoading(false);
      return;
    }

    const filesWithUrls = await Promise.all(
      (data || []).map(async (file) => {
        const { data: signedData, error: signedError } =
          await supabase.storage
            .from("setom-files")
            .createSignedUrl(file.storage_path, 3600);

        if (signedError) {
          console.error(
            "Erreur URL fichier :",
            file.file_name,
            signedError
          );

          return {
            ...file,
            url: null,
          };
        }

        return {
          ...file,
          url: signedData?.signedUrl || null,
        };
      })
    );

    setAttachments(filesWithUrls);
    setAttachmentsLoading(false);
  }

  loadAttachments();
}, [os?.dbId]); 
async function save() {
  try {
    // 1. Chercher une intervention existante pour cet OS
    let { data: intervention, error: interventionError } = await supabase
  .from("interventions")
  .select("id, work_order_id, type, status, planned_surface_m2, actual_surface_m2")
  .eq("work_order_id", os.dbId)
  .maybeSingle();
    if (interventionError) {
      console.error("Erreur recherche intervention :", interventionError);
      alert("Impossible de retrouver l'intervention.");
      return;
    }

    // 2. Si aucune intervention n'existe, on en crée une
    if (!intervention) {
      const { data: newIntervention, error: createInterventionError } =
        await supabase
          .from("interventions")
          .insert({
            work_order_id: os.dbId,
            type: os.intervention || os.work || "Intervention",
            status: "Travaux effectués",
            planned_surface_m2:
              os.quantity && parseFloat(os.quantity)
                ? parseFloat(os.quantity)
                : null,
            actual_surface_m2:
              realSurface && !isNaN(Number(realSurface))
                ? Number(realSurface)
                : null,
          })
          .select("*")
          .single();

      if (createInterventionError) {
        console.error(
          "Erreur création intervention :",
          createInterventionError
        );
        alert(
          "Impossible de créer l'intervention : " +
            createInterventionError.message
        );
        return;
      }

      intervention = newIntervention;
    }

    // 3. Enregistrer les travaux réellement réalisés
    const { error: realizationError } = await supabase
      .from("work_realizations")
      .insert({
        intervention_id: intervention.id,

        designation:
          os.intervention ||
          os.work ||
          "Travaux réalisés",

        quantity:
          realSurface && !isNaN(Number(realSurface))
            ? Number(realSurface)
            : null,

        unit: "m²",

        surface_m2:
          realSurface && !isNaN(Number(realSurface))
            ? Number(realSurface)
            : null,

        thickness_cm:
          thickness && !isNaN(Number(thickness))
            ? Number(thickness)
            : null,

        length_ml:
          sciage && !isNaN(Number(sciage))
            ? Number(sciage)
            : null,

        observations: workComment || null,
      });

    if (realizationError) {
      console.error(
        "Erreur enregistrement travaux :",
        realizationError
      );
      alert(
        "Les travaux n'ont pas pu être enregistrés : " +
          realizationError.message
      );
      return;
    }

    // 4. Mettre l'intervention à jour
    const { error: updateInterventionError } = await supabase
      .from("interventions")
      .update({
        status: "Travaux effectués",
        actual_date: new Date().toISOString().slice(0, 10),
        actual_surface_m2:
          realSurface && !isNaN(Number(realSurface))
            ? Number(realSurface)
            : null,
      })
      .eq("id", intervention.id);

    if (updateInterventionError) {
      console.error(
        "Erreur mise à jour intervention :",
        updateInterventionError
      );
    }

    // 5. Mettre l'OS à "Travaux effectués"
    const { error: workOrderError } = await supabase
      .from("work_orders")
      .update({
        status: "Travaux effectués",
        updated_by: session.user.id,
      })
      .eq("id", os.dbId);

    if (workOrderError) {
      console.error(
        "Erreur mise à jour OS :",
        workOrderError
      );
      alert(
        "Les travaux sont enregistrés, mais le statut de l'OS n'a pas pu être mis à jour."
      );
      return;
    }

    // 6. Mettre également l'affichage de l'application à jour
    onUpdate(os.id, {
      day: day || null,
      status: "Travaux effectués",
    });

    alert("✅ Travaux réalisés enregistrés.");

    onClose();
  } catch (error) {
  console.error("Erreur générale :", error);

  alert(
    "Erreur lors de l'enregistrement :\n\n" +
    (error?.message || "Erreur inconnue") +
    (error?.details ? "\n\nDétails : " + error.details : "") +
    (error?.hint ? "\n\nAide : " + error.hint : "")
  );
}
}
  const tabs = [
    { id: "resume", label: "Résumé", icon: "📋" },
    { id: "travaux", label: "Travaux", icon: "🛠️" },
    { id: "planning", label: "Planning", icon: "📅" },
    { id: "photos", label: "Photos", icon: "📷" },
    { id: "documents", label: "Documents", icon: "📄" },
    { id: "constat", label: "Constat", icon: "💶" },
    { id: "historique", label: "Historique", icon: "📜" },
  ];

  return (
    <div className="modal-bg">
      <div className="modal os-detail-modal">

        {/* =========================
            EN-TÊTE
           ========================= */}

        <div className="modal-header">
          <div>
            <h2>{os.id}</h2>
            <small>{os.address}</small>
          </div>

          <button
            className="close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        {/* =========================
            INFORMATIONS RAPIDES
           ========================= */}

        <div className="os-detail-summary">

          <div className="os-detail-badge">
            <span>Statut</span>
            <strong>{os.status || "Nouveau"}</strong>
          </div>

          <div className="os-detail-badge">
            <span>Matériau</span>
            <strong>{os.work || "—"}</strong>
          </div>

          <div className="os-detail-badge">
            <span>Surface</span>
            <strong>{os.quantity || "—"}</strong>
          </div>

          <div className="os-detail-badge">
            <span>Équipe</span>
            <strong>{os.team || "Non affectée"}</strong>
          </div>

        </div>

        {/* =========================
            ONGLETS
           ========================= */}

        <div className="os-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={
                activeTab === tab.id
                  ? "os-tab active"
                  : "os-tab"
              }
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* =========================
            CONTENU
           ========================= */}

        <div className="os-tab-content">

          {/* RÉSUMÉ */}

          {activeTab === "resume" && (
            <div className="os-section">

              <h3>Informations générales</h3>

              <div className="os-info-grid">

                <div>
                  <span>Ordre de service</span>
                  <strong>{os.id}</strong>
                </div>

                <div>
                  <span>Adresse</span>
                  <strong>{os.address || "—"}</strong>
                </div>

                <div>
                  <span>Matériau</span>
                  <strong>{os.work || "—"}</strong>
                </div>

                <div>
                  <span>Métier</span>
                  <strong>{os.trade || "—"}</strong>
                </div>

                <div>
                  <span>Secteur</span>
                  <strong>{os.sector || "—"}</strong>
                </div>

                <div>
                  <span>Quantité prévue</span>
                  <strong>{os.quantity || "—"}</strong>
                </div>

                <div>
                  <span>Équipe</span>
                  <strong>{os.team || "Non affectée"}</strong>
                </div>

                <div>
                  <span>Jour prévu</span>
                  <strong>{os.day || "Non planifié"}</strong>
                </div>

              </div>

              <div className="os-status-box">
                <span>Échéance</span>

                <strong>
                  {os.deadline
                    ? new Date(os.deadline).toLocaleDateString(
                        "fr-FR"
                      )
                    : "—"}
                </strong>
              </div>

            </div>
          )}

          {/* TRAVAUX */}

          {/* TRAVAUX */}

{activeTab === "travaux" && (
  <div className="os-section">

    <h3>Travaux réalisés</h3>

    <div className="os-work-card">

      <div className="work-summary">
        <strong>
          {os.intervention || os.work || "Intervention"}
        </strong>

        <p>
          Quantité prévue :{" "}
          <strong>{os.quantity || "Non renseignée"}</strong>
        </p>

        <p>
          Matériau :{" "}
          <strong>{os.work || "Non renseigné"}</strong>
        </p>
      </div>

      <hr />

      <h4>Surface réalisée</h4>

      <div className="work-grid">

        <div>
          <label>Longueur (m)</label>
          <input
            type="number"
            step="0.01"
            value={realLength}
            onChange={(e) => {
              const value = e.target.value;
              setRealLength(value);

              const length = Number(value);
              const width = Number(realWidth);

              if (length > 0 && width > 0) {
                setRealSurface(
                  (length * width).toFixed(2)
                );
              }
            }}
            placeholder="Ex. 5"
          />
        </div>

        <div>
          <label>Largeur (m)</label>
          <input
            type="number"
            step="0.01"
            value={realWidth}
            onChange={(e) => {
              const value = e.target.value;
              setRealWidth(value);

              const length = Number(realLength);
              const width = Number(value);

              if (length > 0 && width > 0) {
                setRealSurface(
                  (length * width).toFixed(2)
                );
              }
            }}
            placeholder="Ex. 3"
          />
        </div>

      </div>

      <div className="work-result">
        <span>Surface réellement réalisée</span>
        <strong>
          {realSurface ? `${realSurface} m²` : "—"}
        </strong>
      </div>

      <h4>Caractéristiques</h4>

      <div className="work-grid">

        <div>
          <label>Épaisseur (cm)</label>
          <input
            type="number"
            step="0.5"
            value={thickness}
            onChange={(e) => setThickness(e.target.value)}
            placeholder="Ex. 5"
          />
        </div>

        <div>
          <label>Sciage (ml)</label>
          <input
            type="number"
            step="0.01"
            value={sciage}
            onChange={(e) => setSciage(e.target.value)}
            placeholder="Ex. 13"
          />
        </div>

        <div>
          <label>Joints (ml)</label>
          <input
            type="number"
            step="0.01"
            value={joints}
            onChange={(e) => setJoints(e.target.value)}
            placeholder="Ex. 8"
          />
        </div>

        <div>
          <label>Bouché à clé (U)</label>
          <input
            type="number"
            step="1"
            value={boucheAcle}
            onChange={(e) => setBoucheAcle(e.target.value)}
            placeholder="Ex. 1"
          />
        </div>

        <div>
          <label>Démolition (m²)</label>
          <input
            type="number"
            step="0.01"
            value={demolition}
            onChange={(e) => setDemolition(e.target.value)}
            placeholder="Ex. 2"
          />
        </div>

      </div>

      <h4>Autres travaux</h4>

      <div className="work-grid">

        <div>
          <label>Circulation</label>
          <select
            value={circulation}
            onChange={(e) => setCirculation(e.target.value)}
          >
            <option value="">Non renseigné</option>
            <option value="2h">2 heures</option>
            <option value="1/2 journée">1/2 journée</option>
          </select>
        </div>

        <div>
          <label>Marquage</label>
          <select
            value={marquage}
            onChange={(e) => setMarquage(e.target.value)}
          >
            <option value="">Non renseigné</option>
            <option value="Effectué">Effectué</option>
            <option value="Signature">Signature</option>
          </select>
        </div>

      </div>

      <h4>Observations</h4>

      <textarea
        value={workComment}
        onChange={(e) => setWorkComment(e.target.value)}
        placeholder="Difficultés rencontrées, particularités, complément d'information..."
        rows="4"
      />

      <div className="work-actions">

        <button
          className="primary"
          type="button"
         onClick={save}
        >
          ✅ Transmettre les travaux réalisés
        </button>

      </div>

    </div>

  </div>
)}

          {/* PLANNING */}

          {activeTab === "planning" && (
            <div className="os-section">

              <h3>Planning</h3>

              <div className="os-field">

                <label>Jour d'intervention</label>

                <select
                  value={day}
                  onChange={(e) =>
                    setDay(e.target.value)
                  }
                >
                  <option value="">
                    Non planifié
                  </option>

                  {days.map((d) => (
                    <option
                      key={d.name}
                      value={d.name}
                    >
                      {d.name}
                    </option>
                  ))}
                </select>

              </div>

              <div className="os-field">

                <label>Statut OS</label>

                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value)
                  }
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

              </div>

              <div className="os-planning-info">

                <div>
                  <span>Équipe</span>
                  <strong>
                    {os.team || "Non affectée"}
                  </strong>
                </div>

                <div>
                  <span>Secteur</span>
                  <strong>
                    {os.sector || "—"}
                  </strong>
                </div>

              </div>

            </div>
          )}

          {/* PHOTOS */}

         {/* PHOTOS */}

{activeTab === "photos" && (
  <div className="os-section">

    <h3>Photos</h3>

    {attachmentsLoading ? (
      <div className="os-empty-state">
        📷
        <strong>Chargement des photos...</strong>
      </div>
    ) : attachments.filter(
        (file) => file.mime_type?.startsWith("image/")
      ).length === 0 ? (
      <div className="os-empty-state">
        📷
        <strong>Aucune photo</strong>
        <span>
          Aucune photo n'est actuellement associée à cet OS.
        </span>
      </div>
    ) : (
      <div className="os-photo-grid">

        {attachments
          .filter(
            (file) =>
              file.mime_type?.startsWith("image/") &&
              file.url
          )
          .map((file) => (
            <div
              className="os-photo-card"
              key={file.id}
            >
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
              >
                <img
                  src={file.url}
                  alt={file.file_name}
                />
              </a>

              <div className="os-photo-name">
                {file.file_name}
              </div>
            </div>
          ))}

      </div>
    )}

  </div>
)}

          {/* DOCUMENTS */}

          {activeTab === "documents" && (
            <div className="os-section">

              <h3>Documents</h3>

              <div className="os-empty-state">
                📄
                <strong>Aucun document affiché</strong>
                <span>
                  Les documents associés à cet OS
                  seront affichés ici.
                </span>
              </div>

            </div>
          )}

          {/* CONSTAT */}

          {activeTab === "constat" && (
            <div className="os-section">

              <h3>Constat de facturation</h3>

              <div className="os-empty-state">
                💶
                <strong>Constat non créé</strong>
                <span>
                  Le constat sera généré automatiquement
                  lorsque les travaux seront déclarés
                  effectués.
                </span>
              </div>

            </div>
          )}

          {/* HISTORIQUE */}

          {activeTab === "historique" && (
            <div className="os-section">

              <h3>Historique</h3>

              <div className="os-history">

                <div className="history-item">
                  <span className="history-dot" />

                  <div>
                    <strong>Création de l'OS</strong>
                    <small>
                      Historique détaillé disponible
                      après connexion aux données
                      Supabase.
                    </small>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* =========================
            ACTIONS
           ========================= */}

        <div className="os-actions">

          <button
            className="primary"
            onClick={save}
            type="button"
          >
            💾 Enregistrer
          </button>

          <button
            className="secondary"
            type="button"
            onClick={() =>
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  os.address
                )}`,
                "_blank"
              )
            }
          >
            🧭 Itinéraire
          </button>

        </div>

      </div>
    </div>
  );
}
  
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
