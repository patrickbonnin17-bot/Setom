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
  "À planifier",
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
  const [osList, setOsList] = useState([]);
  const [selectedOS, setSelectedOS] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [teamFilter, setTeamFilter] = useState("Toutes");
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
            <h2>Ordres de service</h2>

            <div className="toolbar">

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
  const [day, setDay] = useState(os.day || "");
  const [status, setStatus] = useState(os.status);

  function save() {
    onUpdate(os.id, {
      day: day || null,
      status,
    });

    onClose();
  }

  return (
    <div className="modal-bg">

      <div className="modal">

        <div className="modal-header">
          <div>
            <h2>{os.id}</h2>
            <small>{os.address}</small>
          </div>

          <button
            className="close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <hr />

        <h3>Informations</h3>

        <p>
          <strong>Travaux :</strong>{" "}
          {os.work}
        </p>

        <p>
          <strong>Métier :</strong>{" "}
          {os.trade}
        </p>

        <p>
          <strong>Secteur :</strong>{" "}
          {os.sector}
        </p>

        <p>
          <strong>Quantité :</strong>{" "}
          {os.quantity}
        </p>

        <div className="intervention">
          <strong>Intervention</strong>

          <p>
            {os.intervention}
          </p>

          <p>
            Équipe : {os.team}
          </p>
        </div>

        <div className="intervention">

          <strong>Planning</strong>

          <p>
            Jour d'intervention
          </p>

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

        <div className="intervention">

          <strong>Statut OS</strong>

          <p></p>

          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value)
            }
          >
            {statuses.map((s) => (
              <option key={s}>
                {s}
              </option>
            ))}
          </select>

        </div>

        <div className="intervention">

          <strong>Actions</strong>

          <div className="os-actions">

            <button
              className="primary"
              onClick={save}
            >
              💾 Enregistrer
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
              🧭 Itinéraire
            </button>

          </div>

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
