import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./planningOverlay.css";

const DAY_COLORS = ["#1976d2", "#2e8b57", "#f39c12", "#8e44ad", "#d32f2f", "#16a6a6", "#e83e8c"];
const STATUS_PLANIFIABLE = ["À planifier", "Planifié"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const monthLabel = (date) => date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const startOfWeek = (date) => { const d = new Date(date); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(12, 0, 0, 0); return d; };
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const fullOsNumber = (order) => `${String(order.osLabel || "OS").trim()}-${new Date(order.creation_date).getFullYear()}-${String(order.os_number).padStart(5, "0")}`;

function Planner({ onClose, initialView = "mois" }) {
  const [view, setView] = useState(initialView);
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(iso(new Date()));
  const [orders, setOrders] = useState([]);
  const [teams, setTeams] = useState([]);
  const [plannerMaterials, setPlannerMaterials] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [sectorFilter, setSectorFilter] = useState("Tous");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [defaultDailyCapacity, setDefaultDailyCapacity] = useState(35);
  const [autoPlanSaving, setAutoPlanSaving] = useState(false);
  const [mapStatus, setMapStatus] = useState("La carte charge les adresses des OS.");
  const [geoPoints, setGeoPoints] = useState({});
  const [geocodingComplete, setGeocodingComplete] = useState(false);
  const [routeSummary, setRouteSummary] = useState("Sélectionnez une journée pour afficher son itinéraire.");
  const [routeTeamId, setRouteTeamId] = useState("");
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerLayerRef = useRef(null);
  const routeLayerRef = useRef(null);

  async function load() {
    setLoading(true); setError("");
    const { data: rows, error: woError } = await supabase.from("work_orders").select("id, os_number, creation_date, address, postal_code, city, sector_id, latitude, longitude, material_detail, planned_surface_m2, status, deadline_date, is_night").order("os_number", { ascending: true });
    if (woError) { setError(woError.message); setLoading(false); return; }
    const { data: settingsRow, error: settingsError } = await supabase.from("app_settings").select("os_label, enrobee_reference_capacity_m2").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (settingsError) console.error("Erreur lecture du libellé OS pour le planning :", settingsError);
    const osLabel = String(settingsRow?.os_label || "OS").trim() || "OS";
    const defaultCapacity = Number(settingsRow?.enrobee_reference_capacity_m2);
    setDefaultDailyCapacity(Number.isFinite(defaultCapacity) && defaultCapacity > 0 ? defaultCapacity : 35);
    const materialResult = await supabase.from("materials").select("id, name, category, active, planning_difficulty, indicative_capacity_m2, sort_order").order("sort_order", { ascending: true });
    if (materialResult.error) console.error("Erreur chargement capacités matériaux :", materialResult.error);
    setPlannerMaterials(materialResult.error ? [] : (materialResult.data || []).filter((material) => material.active !== false));
    const sectorResult = await supabase.from("sectors").select("id, name, active, sort_order").order("sort_order", { ascending: true });
    const sectorRows = sectorResult.error ? [] : (sectorResult.data || []).filter((sector) => sector.active !== false);
    if (sectorResult.error) console.error("Erreur chargement secteurs du planning :", sectorResult.error);
    setSectors(sectorRows);
    const sectorById = new Map(sectorRows.map((sector) => [sector.id, sector.name]));
    const ids = (rows || []).map((r) => r.id);
    let interventions = [];
    if (ids.length) {
      const result = await supabase.from("interventions").select("id, work_order_id, team_id, planned_date, planned_order, status").in("work_order_id", ids);
      if (!result.error) interventions = result.data || [];
    }
    const allTeams = await supabase.from("teams").select("id, name, active, usual_sector_id, indicative_capacity").order("name");
    const teamRows = allTeams.error ? [] : (allTeams.data || []).filter((team) => team.active !== false);
    const byWO = new Map();
    for (const item of interventions) {
      const previous = byWO.get(item.work_order_id);
      if (!previous || (!previous.planned_date && item.planned_date)) byWO.set(item.work_order_id, item);
    }
    const byTeam = new Map(teamRows.map((x) => [x.id, x.name]));
    setTeams(teamRows);
    setRouteTeamId((current) => teamRows.some((team) => team.id === current) ? current : (teamRows[0]?.id || ""));
    setOrders((rows || []).map((r) => {
      const i = byWO.get(r.id);
      return { ...r, osLabel, sector_name: sectorById.get(r.sector_id) || "Non classé", interventionId: i?.id || null, intervention_status: i?.status || null, planned_date: i?.planned_date || null, planned_order: Number(i?.planned_order || 0), team_id: i?.team_id || null, team_name: byTeam.get(i?.team_id) || "Non affectée" };
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

  async function autoPlanUnplanned() {
    const inconsistent = orders.filter((order) => STATUS_PLANIFIABLE.includes(order.status) && !order.planned_date && order.intervention_status && !["À planifier", "Planifié"].includes(order.intervention_status));
    const queue = orders
      .filter((order) => STATUS_PLANIFIABLE.includes(order.status) && !order.planned_date && (!order.intervention_status || ["À planifier", "Planifié"].includes(order.intervention_status)))
      .sort((a, b) => String(a.deadline_date || "9999-12-31").localeCompare(String(b.deadline_date || "9999-12-31")) || String(a.sector_name || "").localeCompare(String(b.sector_name || ""), "fr") || a.os_number - b.os_number);
    if (!queue.length) { setError(inconsistent.length ? inconsistent.length + " OS ont un statut d'intervention incohérent avec leur statut OS. Ils ont été laissés intacts : ouvrez-les et vérifiez leur historique avant de les replanifier." : "Aucun OS à planifier automatiquement."); return; }
    if (!teams.length) { setError("Aucune équipe active. Créez d'abord les équipes et, si besoin, leurs secteurs habituels dans l'onglet Équipes."); return; }
    const startingLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR");
    if (!window.confirm("Planifier automatiquement " + queue.length + " OS à partir du " + startingLabel + " ? Les OS déjà planifiés ne seront pas déplacés. Les journées sont réparties du lundi au vendredi selon les secteurs et les capacités des équipes." + (inconsistent.length ? "\\n\\n" + inconsistent.length + " OS ayant un historique d'intervention incohérent seront ignorés pour préserver leurs données." : ""))) return;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;
    if (authError || !user) { setError("Connexion requise pour planifier automatiquement."); return; }
    setAutoPlanSaving(true);
    setError("");
    try {
      const loads = new Map();
      const dayOrders = new Map();
      const materialForOrder = (order) => {
        const name = String(order.material_detail || "").trim().toLocaleLowerCase("fr-FR");
        return plannerMaterials.find((material) => String(material.name || "").trim().toLocaleLowerCase("fr-FR") === name)
          || plannerMaterials.find((material) => String(material.category || "").trim().toLocaleLowerCase("fr-FR") === name)
          || null;
      };
      const effectiveCapacity = (order, team) => {
        const teamCapacity = Number(team?.indicative_capacity) > 0 ? Number(team.indicative_capacity) : defaultDailyCapacity;
        const material = materialForOrder(order);
        const materialCapacity = Number(material?.indicative_capacity_m2) > 0 ? Number(material.indicative_capacity_m2) : teamCapacity;
        const difficulty = Number(material?.planning_difficulty) > 0 ? Number(material.planning_difficulty) : 1;
        return Math.min(teamCapacity, materialCapacity) / difficulty;
      };
      for (const order of orders) {
        if (!order.planned_date) continue;
        const nextOrder = Math.max(Number(dayOrders.get(order.planned_date) || 0), Number(order.planned_order || 0));
        dayOrders.set(order.planned_date, nextOrder);
        if (order.team_id) {
          const key = order.planned_date + "|" + order.team_id;
          const team = teams.find((item) => item.id === order.team_id);
          const capacity = effectiveCapacity(order, team);
          const effortShare = capacity > 0 ? Math.max(0, Number(order.planned_surface_m2 || 0)) / capacity : 1;
          loads.set(key, Number(loads.get(key) || 0) + effortShare);
        }
      }
      const assignments = [];
      const activeTeams = teams.filter((team) => team.active !== false);
      const start = new Date(selectedDate + "T12:00:00");
      for (const order of queue) {
        let selected = null;
        for (let offset = 0; offset < 120 && !selected; offset += 1) {
          const candidateDate = iso(addDays(start, offset));
          const weekday = new Date(candidateDate + "T12:00:00").getDay();
          if (weekday === 0 || weekday === 6) continue;
          let teamPool = activeTeams;
          if (order.sector_id) {
            const sectorTeams = activeTeams.filter((team) => !team.usual_sector_id || team.usual_sector_id === order.sector_id);
            if (sectorTeams.length) teamPool = sectorTeams;
          }
          const surface = Math.max(0, Number(order.planned_surface_m2 || 0));
          const choices = teamPool.map((team) => {
            const capacity = effectiveCapacity(order, team);
            const effortShare = capacity > 0 ? surface / capacity : 1;
            const key = candidateDate + "|" + team.id;
            const used = Number(loads.get(key) || 0);
            const fits = effortShare <= 1 && used + effortShare <= 1;
            return { team, capacity, effortShare, used, key, fits, ratio: used };
          }).filter((choice) => choice.fits).sort((a, b) => a.ratio - b.ratio || a.used - b.used || a.team.name.localeCompare(b.team.name, "fr"));
          if (!choices.length) continue;
          const choice = choices[0];
          const position = Number(dayOrders.get(candidateDate) || 0) + 1;
          selected = { work_order_id: order.id, intervention_id: order.interventionId || null, planned_date: candidateDate, team_id: choice.team.id, planned_order: position };
          assignments.push(selected);
          loads.set(choice.key, choice.used + choice.effortShare);
          dayOrders.set(candidateDate, position);
        }
        if (!selected) throw new Error("Impossible de trouver une place dans les 120 prochains jours pour " + fullOsNumber(order) + ". Vérifiez la capacité des équipes.");
      }
      const lateAssignments = assignments.filter((assignment) => {
        const order = queue.find((item) => item.id === assignment.work_order_id);
        return order?.deadline_date && assignment.planned_date > order.deadline_date;
      });
      if (lateAssignments.length) {
        const preview = lateAssignments.slice(0, 5).map((assignment) => {
          const order = queue.find((item) => item.id === assignment.work_order_id);
          return fullOsNumber(order) + " → " + new Date(assignment.planned_date + "T12:00:00").toLocaleDateString("fr-FR") + " (échéance " + new Date(order.deadline_date + "T12:00:00").toLocaleDateString("fr-FR") + ")";
        }).join("\n");
        if (!window.confirm(lateAssignments.length + " OS seraient planifiés après leur échéance contractuelle.\n\n" + preview + (lateAssignments.length > 5 ? "\\n…" : "") + "\n\nContinuer quand même ?")) return;
      }
      const { data: result, error: applyError } = await supabase.rpc("apply_setom_planning_batch", {
        p_assignments: assignments,
        p_user_id: user.id
      });
      if (applyError) throw applyError;
      if (Number(result?.planned_count) !== assignments.length) throw new Error("La base n'a pas confirmé la planification de tous les OS.");
      window.dispatchEvent(new Event("setom:planning-updated"));
      await load();
      alert("✅ " + assignments.length + " OS planifiés. Les échéances, les secteurs et les capacités des équipes ont été pris en compte." + (inconsistent.length ? "\\n\\n" + inconsistent.length + " OS à statut incohérent ont été laissés intacts." : "") + "\\n\\nVérifiez la carte et le classeur avant l'envoi aux équipes.");
    } catch (autoError) {
      console.error("Erreur de planification automatique :", autoError);
      setError(autoError?.message || "Impossible d'appliquer la planification automatique.");
    } finally { setAutoPlanSaving(false); }
  }

  async function planOrder(order, date, teamId = order.team_id) {
    if (!STATUS_PLANIFIABLE.includes(order.status)) { setError("Cet OS a déjà quitté la file de planification. Sa date reste visible dans le classeur."); return; }
    setSavingId(order.id); setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) throw new Error("Connexion requise pour modifier le planning.");
      let interventionId = order.interventionId;
      const dateKey = date || null;
      const destinationOrders = dateKey ? (byDate.get(dateKey) || []) : [];
      const currentIndex = destinationOrders.findIndex((item) => item.id === order.id);
      const nextPosition = !dateKey ? 0 : order.planned_date === dateKey ? Math.max(1, currentIndex >= 0 ? currentIndex + 1 : Number(order.planned_order || 1)) : destinationOrders.length + 1;
      if (!interventionId) {
        const { data, error: insertError } = await supabase.from("interventions").insert({ work_order_id: order.id, type: order.material_detail || "Intervention", status: date ? "Planifié" : "À planifier", planned_date: date || null, planned_surface_m2: order.planned_surface_m2 || null, team_id: teamId || null, planned_order: nextPosition }).select("id").single();
        if (insertError) throw insertError;
        interventionId = data.id;
      } else {
        const { error: updateError } = await supabase.from("interventions").update({ planned_date: date || null, status: date ? "Planifié" : "À planifier", team_id: teamId || null, planned_order: nextPosition }).eq("id", interventionId);
        if (updateError) throw updateError;
      }
      const newStatus = date ? "Planifié" : "À planifier";
      const { error: statusError } = await supabase.from("work_orders").update({ status: newStatus, updated_by: authData.user.id }).eq("id", order.id);
      if (statusError) throw statusError;
      window.dispatchEvent(new Event("setom:planning-updated"));
      setOrders((current) => current.map((x) => x.id === order.id ? { ...x, interventionId, planned_date: date || null, team_id: teamId || null, team_name: teams.find((t) => t.id === teamId)?.name || "Non affectée", status: newStatus, planned_order: nextPosition } : x));
    } catch (e) { setError(e?.message || "Impossible d'enregistrer le planning."); }
    finally { setSavingId(null); }
  }

  async function moveOrder(order, delta) {
    if (!order.planned_date) return;
    const next = iso(addDays(new Date(order.planned_date + "T12:00:00"), delta));
    await planOrder(order, next, order.team_id);
    setSelectedDate(next); setCursor(new Date(next + "T12:00:00"));
  }

  async function reorderOrder(order, delta) {
    if (!STATUS_PLANIFIABLE.includes(order.status)) return;
    const list = [...(byDate.get(order.planned_date) || [])];
    const index = list.findIndex((x) => x.id === order.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= list.length) return;
    const current = list[index];
    const other = list[target];
    if (!STATUS_PLANIFIABLE.includes(other.status)) return;
    setSavingId(order.id); setError("");
    try {
      const a = other.planned_order || index + 1;
      const b = current.planned_order || target + 1;
      const first = await supabase.from("interventions").update({ planned_order: a }).eq("id", current.interventionId);
      if (first.error) throw first.error;
      const second = await supabase.from("interventions").update({ planned_order: b }).eq("id", other.interventionId);
      if (second.error) throw second.error;
      window.dispatchEvent(new Event("setom:planning-updated"));
      setOrders((currentOrders) => currentOrders.map((x) => x.id === current.id ? { ...x, planned_order: a } : x.id === other.id ? { ...x, planned_order: b } : x));
    } catch (e) { setError(e?.message || "Impossible de modifier l'ordre d'intervention."); }
    finally { setSavingId(null); }
  }

  async function changeOrderTeam(order, teamId) { await planOrder(order, order.planned_date, teamId || null); }

  const monthCells = useMemo(() => { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12); const start = startOfWeek(first); return Array.from({ length: 42 }, (_, i) => addDays(start, i)); }, [cursor]);
  const weekCells = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)), [cursor]);
  const selectedOrders = byDate.get(selectedDate) || [];
  const mapOrders = useMemo(() => orders.filter((o) => STATUS_PLANIFIABLE.includes(o.status) && (sectorFilter === "Tous" || o.sector_name === sectorFilter)), [orders, sectorFilter]);
  const geoTargets = useMemo(() => orders.filter((o) => STATUS_PLANIFIABLE.includes(o.status) || !!o.planned_date), [orders]);

  useEffect(() => {
    if (view !== "carte" || !mapElementRef.current) return;
    const map = L.map(mapElementRef.current, { zoomControl: true, scrollWheelZoom: true }).setView([43.6045, 1.444], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>' }).addTo(map);
    const markers = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markerLayerRef.current = markers;
    map.whenReady(() => map.invalidateSize());
    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, [view]);

  useEffect(() => {
    if (view !== "carte") return;
    let cancelled = false;
    if (!geoTargets.length) {
      setGeoPoints({});
      setMapStatus("Aucun OS à géocoder.");
      setGeocodingComplete(true);
      return () => { cancelled = true; };
    }
    async function geocodeOrders() {
      setGeocodingComplete(false);
      let cache = {};
      try { cache = JSON.parse(sessionStorage.getItem("setom-geocodes-v1") || "{}"); } catch { cache = {}; }
      const next = {};
      let processed = 0;
      setMapStatus("Localisation des adresses des OS…");
      for (const order of geoTargets) {
        if (cancelled) return;
        const addressParts = [order.address, order.postal_code, order.city, "France"].filter(Boolean);
        const query = addressParts.join(" ");
        const cacheKey = query.toLocaleLowerCase("fr-FR");
        const hasStoredCoordinates = order.latitude !== null && order.latitude !== undefined && order.longitude !== null && order.longitude !== undefined && Number.isFinite(Number(order.latitude)) && Number.isFinite(Number(order.longitude));
        let point = hasStoredCoordinates ? { lat: Number(order.latitude), lon: Number(order.longitude) } : (Object.prototype.hasOwnProperty.call(cache, cacheKey) ? cache[cacheKey] : undefined);
        if (point === undefined) {
          try {
            const params = new URLSearchParams({ q: query, limit: "1" });
            const response = await fetch("https://data.geopf.fr/geocodage/search?" + params.toString(), { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error("Service de géocodage indisponible (HTTP " + response.status + ").");
            const payload = await response.json();
            const coordinates = payload?.features?.[0]?.geometry?.coordinates;
            point = Array.isArray(coordinates) && coordinates.length >= 2 ? { lat: Number(coordinates[1]), lon: Number(coordinates[0]) } : null;
            cache[cacheKey] = point;
            try { sessionStorage.setItem("setom-geocodes-v1", JSON.stringify(cache)); } catch { /* cache facultatif */ }
          } catch (geocodeError) {
            console.warn("Géocodage indisponible pour", query, geocodeError);
            point = null;
          }
        }
        if (point && Number.isFinite(point.lat) && Number.isFinite(point.lon)) {
          next[order.id] = point;
          if (!hasStoredCoordinates) {
            const { error: coordinateSaveError } = await supabase.from("work_orders").update({ latitude: point.lat, longitude: point.lon }).eq("id", order.id);
            if (coordinateSaveError) console.warn("Coordonnées affichées mais non enregistrées pour", fullOsNumber(order), coordinateSaveError);
          }
        }
        processed += 1;
        if (!cancelled) {
          setGeoPoints({ ...next });
          setMapStatus("Localisation des adresses : " + processed + "/" + geoTargets.length + "…");
        }
      }
      if (!cancelled) {
        setGeoPoints(next);
        const located = Object.keys(next).length;
        setMapStatus(located + "/" + geoTargets.length + " adresses localisées. Les adresses non reconnues restent accessibles dans la liste.");
        setGeocodingComplete(true);
      }
    }
    geocodeOrders();
    return () => { cancelled = true; };
  }, [view, geoTargets]);

  useEffect(() => {
    if (view !== "carte" || !mapInstanceRef.current || !markerLayerRef.current) return;
    markerLayerRef.current.clearLayers();
    const locatedOrders = mapOrders.filter((order) => geoPoints[order.id]);
    for (const order of locatedOrders) {
      const point = geoPoints[order.id];
      const isPlanned = !!order.planned_date;
      const color = isPlanned ? "#2563eb" : "#dc2626";
      const marker = L.circleMarker([point.lat, point.lon], { radius: 8, color, weight: 2, fillColor: color, fillOpacity: 0.9 }).addTo(markerLayerRef.current);
      const label = document.createElement("span");
      label.textContent = fullOsNumber(order) + " · " + (order.address || "Adresse non renseignée");
      marker.bindTooltip(label, { direction: "top", opacity: 0.95 });
      marker.on("click", () => {
        if (order.planned_date) {
          setSelectedDate(order.planned_date);
          setCursor(new Date(order.planned_date + "T12:00:00"));
        }
      });
    }
    if (locatedOrders.length > 0) {
      const bounds = L.latLngBounds(locatedOrders.map((order) => [geoPoints[order.id].lat, geoPoints[order.id].lon]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [28, 28], maxZoom: locatedOrders.length === 1 ? 15 : 14 });
    }
  }, [view, mapOrders, geoPoints]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (view !== "carte" || !map) return;
    let cancelled = false;
    if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
    if (!geocodingComplete) { setRouteSummary("Localisation des adresses avant calcul de l’itinéraire…"); return; }
    if (!routeTeamId) { setRouteSummary("Aucune équipe active. Créez une équipe avant de calculer un itinéraire."); return; }
    const stops = (byDate.get(selectedDate) || []).filter((order) => STATUS_PLANIFIABLE.includes(order.status) && order.team_id === routeTeamId && geoPoints[order.id] && (sectorFilter === "Tous" || order.sector_name === sectorFilter));
    if (stops.length === 0) { setRouteSummary("Aucun OS planifié et géolocalisé pour cette équipe et ce secteur sur cette journée."); return; }
    if (stops.length === 1) { setRouteSummary("1 arrêt planifié. Ajoutez un autre OS à la journée pour calculer un itinéraire."); map.setView([geoPoints[stops[0].id].lat, geoPoints[stops[0].id].lon], 14); return; }
    setRouteSummary("Calcul de l’itinéraire de " + stops.length + " arrêts…");
    async function calculateRoute() {
      try {
        const coordinates = stops.map((order) => geoPoints[order.id].lon + "," + geoPoints[order.id].lat).join(";");
        const response = await fetch("https://router.project-osrm.org/route/v1/driving/" + coordinates + "?overview=full&geometries=geojson");
        if (!response.ok) throw new Error("Service d’itinéraire indisponible (HTTP " + response.status + ").");
        const payload = await response.json();
        const route = payload?.routes?.[0];
        if (!route?.geometry?.coordinates?.length) throw new Error("Aucun itinéraire routier trouvé pour ces adresses.");
        if (cancelled || !mapInstanceRef.current) return;
        const latLngs = route.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
        routeLayerRef.current = L.polyline(latLngs, { color: "#175cd3", weight: 5, opacity: 0.82 }).addTo(mapInstanceRef.current);
        mapInstanceRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [35, 35] });
        const km = (Number(route.distance || 0) / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
        const minutes = Math.round(Number(route.duration || 0) / 60);
        setRouteSummary(stops.length + " arrêts · " + km + " km · environ " + minutes + " min de conduite (estimation routière).");
      } catch (routeError) {
        if (!cancelled) { console.warn("Calcul d’itinéraire impossible :", routeError); setRouteSummary("Itinéraire indisponible pour le moment. Les OS restent planifiables sur la carte."); }
      }
    }
    calculateRoute();
    return () => { cancelled = true; };
  }, [view, selectedDate, byDate, geoPoints, geocodingComplete, sectorFilter, routeTeamId]);

  function navigateDate(delta) {
    if (view === "mois") { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1, 12)); return; }
    const step = view === "semaine" || view === "classeur-semaine" ? 7 : 1;
    const next = addDays(new Date(selectedDate + "T12:00:00"), delta * step);
    setSelectedDate(iso(next));
    setCursor(next);
  }

  function renderOrder(order) {
    const dayOrders = byDate.get(order.planned_date) || [];
    const index = dayOrders.findIndex((x) => x.id === order.id);
    return <div key={order.id} className="setom-plan-order">
      <strong>{fullOsNumber(order)}</strong>
      <span>{order.address}{order.city ? `, ${order.city}` : ""}</span>
      <small>{order.material_detail || "Intervention"} · {order.planned_surface_m2 ? `${order.planned_surface_m2} m²` : "surface non renseignée"}</small>
      {STATUS_PLANIFIABLE.includes(order.status) ? <div className="setom-plan-order-actions">
        <button disabled={savingId === order.id || index === 0 || !STATUS_PLANIFIABLE.includes(dayOrders[index - 1]?.status)} title="Monter dans l'itinéraire" onClick={() => reorderOrder(order, -1)}>↑</button>
        <button disabled={savingId === order.id || index === dayOrders.length - 1 || !STATUS_PLANIFIABLE.includes(dayOrders[index + 1]?.status)} title="Descendre dans l'itinéraire" onClick={() => reorderOrder(order, 1)}>↓</button>
        <button disabled={savingId === order.id} title="Jour précédent" onClick={() => moveOrder(order, -1)}>←</button>
        <button disabled={savingId === order.id} title="Jour suivant" onClick={() => moveOrder(order, 1)}>→</button>
        <select value={order.team_id || ""} onChange={(e) => changeOrderTeam(order, e.target.value || null)} disabled={savingId === order.id}>
          <option value="">Équipe</option>{order.team_id && !teams.some((t) => t.id === order.team_id) && <option value={order.team_id} disabled>Inactive — {order.team_name || "Équipe"}</option>}{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div> : <small className="setom-order-status-readonly">Statut conservé : {order.status}</small>}
    </div>;
  }

  return <div className="setom-planner-overlay">
    <div className="setom-planner">
      <header className="setom-planner-header"><div><h2>📅 Planning SETOM</h2><p>Planification, itinéraires et classeurs quotidiens</p></div><button onClick={onClose}>✕</button></header>
      {error && <div className="setom-plan-error">⚠️ {error}</div>}
      <div className="setom-plan-toolbar">
        <div className="setom-plan-tabs">{[["mois","Mois"],["semaine","Semaine"],["jour","Jour"],["carte","Carte / itinéraire"],["classeur","Classeur"],["classeur-semaine","Classeur semaine"]].map(([id,label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>)}</div>
        <div className="setom-plan-nav"><button onClick={() => navigateDate(-1)}>‹</button><strong>{view === "mois" ? monthLabel(cursor) : new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong><button onClick={() => navigateDate(1)}>›</button><button onClick={() => { const now = new Date(); setCursor(now); setSelectedDate(iso(now)); }}>Aujourd'hui</button><button disabled={autoPlanSaving || loading} onClick={autoPlanUnplanned}>{autoPlanSaving ? "Planification…" : "✨ Planifier automatiquement"}</button></div>
      </div>
      {loading ? <div className="setom-plan-loading">Chargement du planning…</div> : <>
        {view === "carte" && <div className="setom-map-layout">
          <div className="setom-map-main">
            <div className="setom-map-route-summary"><div><strong>Itinéraire par équipe — {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</strong><label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12, color: "#475569" }}>Équipe<select value={routeTeamId} onChange={(e) => setRouteTeamId(e.target.value)} style={{ maxWidth: 240 }}><option value="">Choisir une équipe…</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><span>{routeSummary}</span></div><span className="setom-map-legend"><i className="unplanned"></i> À planifier <i className="planned"></i> Planifié</span></div>
            <div ref={mapElementRef} className="setom-map-canvas" aria-label="Carte interactive des OS planifiables"></div>
            <small className="setom-map-attribution">{mapStatus} · Fond cartographique © OpenStreetMap contributors · Géocodage IGN Géoplateforme · calcul routier OSRM (service public de démonstration).</small>
          </div>
          <aside className="setom-map-order-list"><header style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>OS planifiables</strong><span>{mapOrders.length} OS</span></div><label style={{ fontSize: 12, color: "#475569" }}>Secteur<select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}><option value="Tous">Tous les secteurs</option>{sectors.map((sector) => <option key={sector.id} value={sector.name}>{sector.name}</option>)}<option value="Non classé">Non classés</option></select></label></header>
            {mapOrders.map((o) => <article className="setom-map-order" key={o.id}>
              <strong>{fullOsNumber(o)}</strong><span>{o.address}{o.city ? `, ${o.city}` : ""}</span>
              <small>{o.sector_name || "Non classé"} · {o.material_detail || "Intervention"} · {o.planned_surface_m2 ? `${o.planned_surface_m2} m²` : "surface non renseignée"}{o.is_night ? " · Nuit" : ""}</small>
              <label>Date de passage<input type="date" value={o.planned_date || selectedDate} disabled={savingId === o.id} onChange={(e) => planOrder(o, e.target.value || null, o.team_id)} /></label>
              <label>Équipe<select value={o.team_id || ""} onChange={(e) => changeOrderTeam(o, e.target.value || null)} disabled={savingId === o.id}><option value="">Non affectée</option>{o.team_id && !teams.some((t) => t.id === o.team_id) && <option value={o.team_id} disabled>Inactive — {o.team_name || "Équipe"}</option>}{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              <button disabled={savingId === o.id || o.planned_date === selectedDate} onClick={() => planOrder(o, selectedDate, o.team_id)}>{o.planned_date ? "Déplacer vers cette journée" : "Ajouter à cette journée"}</button>
              {o.planned_date && <button className="setom-map-remove" disabled={savingId === o.id} onClick={() => planOrder(o, null, o.team_id)}>Retirer du planning</button>}
            </article>)}
            {mapOrders.length === 0 && <p className="setom-week-binder-empty">Aucun OS dans la file « À planifier / Planifié ».</p>}
          </aside>
        </div>}
        {view === "mois" && <div className="setom-month-grid">{monthCells.map((date) => { const key = iso(date); const items = byDate.get(key) || []; const inMonth = date.getMonth() === cursor.getMonth(); return <button key={key} className={`setom-month-cell ${inMonth ? "" : "muted"} ${key === selectedDate ? "selected" : ""}`} onClick={() => { setSelectedDate(key); setCursor(new Date(date.getFullYear(), date.getMonth(), 1, 12)); }}><div className="setom-month-day"><span>{date.getDate()}</span>{items.length > 0 && <b>{items.length}</b>}</div>{items.slice(0, 3).map((o) => <div className="setom-mini-order" key={o.id}>{String(o.os_number).padStart(5, "0")} · {o.address}</div>)}{items.length > 3 && <small>+ {items.length - 3} autre(s)</small>}</button>; })}</div>}
        {view === "semaine" && <div className="setom-week-grid">{weekCells.map((date, i) => { const key = iso(date); return <div className="setom-week-col" key={key}><div className="setom-week-head" style={{ borderTopColor: DAY_COLORS[i] }}><strong>{dayNames[i]}</strong><span>{date.getDate()}/{date.getMonth() + 1}</span></div><div className="setom-week-body">{(byDate.get(key) || []).map(renderOrder)}{(byDate.get(key) || []).length === 0 && <button className="setom-drop-empty" onClick={() => { setSelectedDate(key); setView("jour"); }}>+ Ajouter un OS</button>}</div></div>; })}</div>}
        {view === "jour" && <div className="setom-day-view"><div className="setom-day-title"><strong>{new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong><span>{selectedOrders.length} OS planifié(s)</span></div>{selectedOrders.map(renderOrder)}<div className="setom-add-row"><select defaultValue="" onChange={(e) => { const o = orders.find((x) => String(x.id) === e.target.value); if (o) planOrder(o, selectedDate, o.team_id); e.target.value = ""; }}><option value="">+ Ajouter un OS à cette journée…</option>{orders.filter((o) => STATUS_PLANIFIABLE.includes(o.status) && !o.planned_date).map((o) => <option key={o.id} value={o.id}>{fullOsNumber(o)} · {o.address}</option>)}</select></div></div>}
        {view === "classeur" && <div className="setom-binder"><div className="setom-binder-head"><div><strong>Classeur journalier</strong><span>{new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span></div><button onClick={() => window.print()}>🖨️ Imprimer</button></div>{selectedOrders.map((o, i) => <div className="setom-binder-card" key={o.id}><div className="setom-binder-number" style={{ background: DAY_COLORS[(new Date(selectedDate + "T12:00:00").getDay() + 6) % 7] }}>{i + 1}</div><div><strong>{fullOsNumber(o)}</strong><span>{o.address}{o.city ? `, ${o.city}` : ""}</span><span>{o.material_detail || "Intervention"} · {o.planned_surface_m2 ? `${o.planned_surface_m2} m²` : "—"}</span><span>Équipe : {o.team_name}</span></div><div className="setom-binder-actions">{STATUS_PLANIFIABLE.includes(o.status) ? <><button onClick={() => reorderOrder(o, -1)}>↑</button><button onClick={() => reorderOrder(o, 1)}>↓</button></> : <span>{o.status}</span>}</div></div>)}{selectedOrders.length === 0 && <p>Aucun OS planifié ce jour.</p>}</div>}
        {view === "classeur-semaine" && <div className="setom-week-binder">{weekCells.map((date, i) => { const key = iso(date); const items = byDate.get(key) || []; return <section className="setom-week-binder-day" key={key}><header style={{ borderLeftColor: DAY_COLORS[i] }}><strong>{dayNames[i]}</strong><span>{date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })} · {items.length} OS</span></header>{items.map((o, index) => <div className="setom-week-binder-row" key={o.id}><b>{index + 1}</b><strong>{fullOsNumber(o)}</strong><span>{o.address}{o.city ? `, ${o.city}` : ""}</span><span>{o.material_detail || "Intervention"}</span><span>{o.team_name}</span></div>)}{items.length === 0 && <div className="setom-week-binder-empty">Aucun OS planifié</div>}</section>; })}<button className="primary setom-print-week" onClick={() => window.print()}>🖨️ Imprimer le classeur hebdomadaire</button></div>}
      </>}
      <footer className="setom-plan-footer"><strong>OS non planifiés : {orders.filter((o) => STATUS_PLANIFIABLE.includes(o.status) && !o.planned_date).length}</strong><span>Date, équipe, secteur et capacité sont pris en compte. La planification automatique ne déplace pas les OS déjà planifiés.</span></footer>
    </div>
  </div>;
}

let root = null;
function openPlanner(event) {
  const button = event.target.closest("button");
  const mainNavButton = button && button.closest(".nav");
  if (!button || !mainNavButton) return;
  const wantsMap = button.textContent.includes("Carte");
  const wantsPlanning = button.textContent.includes("Planning");
  if (!wantsMap && !wantsPlanning) return;
  event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
  if (root) return;
  const host = document.createElement("div"); host.id = "setom-planner-host"; document.body.appendChild(host);
  root = createRoot(host);
  root.render(<Planner initialView={wantsMap ? "carte" : "mois"} onClose={() => { root?.unmount(); root = null; host.remove(); }} />);
}
document.addEventListener("click", openPlanner, true);
