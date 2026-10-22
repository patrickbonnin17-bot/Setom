import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import { CalendarDays, MapPin, RefreshCw, Route, X } from "lucide-react";
import { supabase } from "../supabase";

const STATUS_CLASS = {
  "Nouveau OS": "blue",
  "Planifié": "purple",
  "En travaux": "amber",
  "Travaux réalisés": "green",
  "À vérifier": "purple",
  "Validé": "green",
  "Réserve": "red",
  "Payé": "gray",
  "Archivé": "gray",
  "En erreur": "red",
  "En attente": "gray"
};

const esc = (v) => String(v || "").replace(/[&<>\"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#39;" }[c]));
const todayISO = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const shortAddress = (o) => [o.address, o.postal_code, o.city].filter(Boolean).join(", ");
const osLabel = (o) => `OS-${new Date(o.creation_date || todayISO()).getFullYear()}-${String(o.os_number || "").padStart(5,"0")}`;

function openOSFromMap(id, label) {
  const buttons = [...document.querySelectorAll(".map-side-list button")];
  const button = buttons.find((b) => b.textContent?.includes(label));
  if (button) { button.click(); return; }
  window.dispatchEvent(new CustomEvent("setom:open-os", { detail: { id } }));
}

export default function SetomOperationalMapOverlay() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const find = () => {
      const heading = [...document.querySelectorAll("h1")].find((h) => h.textContent?.trim() === "Carte des interventions");
      const card = heading?.closest(".page-content")?.querySelector(".leaflet-card") || document.querySelector(".leaflet-card");
      setTarget(card || null);
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return target ? createPortal(<OperationalMap />, target) : null;
}

function OperationalMap() {
  const [date, setDate] = useState(todayISO());
  const [os, setOs] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [routing, setRouting] = useState(false);
  const [message, setMessage] = useState("");
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const routeRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const [o, i] = await Promise.all([
        supabase.from("work_orders").select("id,os_number,creation_date,address,postal_code,city,status,latitude,longitude,problem_suspended").eq("problem_suspended", false),
        supabase.from("interventions").select("id,work_order_id,planned_date,planned_order,team_id,status").eq("planned_date", date).order("planned_order", { ascending: true })
      ]);
      if (o.error) throw o.error;
      if (i.error) throw i.error;
      setOs(o.data || []);
      setInterventions(i.data || []);
    } catch (e) {
      setMessage("Lecture de la carte impossible : " + (e?.message || "erreur inconnue"));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [date]);

  const scheduled = useMemo(() => {
    const byId = new Map((os || []).map((o) => [o.id, o]));
    return (interventions || []).map((i) => {
      const o = byId.get(i.work_order_id);
      return o ? { ...o, _order: Number(i.planned_order || 0), _teamId: i.team_id } : null;
    }).filter(Boolean).sort((a,b) => (a._order || 9999) - (b._order || 9999));
  }, [os, interventions]);

  const points = useMemo(() => scheduled.filter((o) => Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude))), [scheduled]);
  const unlocated = scheduled.length - points.length;

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, scrollWheelZoom: true }).setView([43.6045, 1.444], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    routeRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const timer = setTimeout(() => map.invalidateSize(), 150);
    return () => { clearTimeout(timer); map.remove(); mapRef.current = null; markersRef.current = null; routeRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds = [];
    points.forEach((o, index) => {
      const lat = Number(o.latitude), lng = Number(o.longitude);
      bounds.push([lat, lng]);
      const order = o._order > 0 ? o._order : index + 1;
      const tone = STATUS_CLASS[o.status] || "gray";
      const html = `<div class="setom-operational-marker ${tone}"><b>${order}</b></div>`;
      const icon = L.divIcon({ className: "", html, iconSize: [38, 38], iconAnchor: [19, 19] });
      const marker = L.marker([lat, lng], { icon }).addTo(layer);
      marker.bindPopup(`<strong>${esc(osLabel(o))}</strong><br>${esc(shortAddress(o))}<br><span>${esc(o.status || "")}</span><br><button class="setom-map-open" data-os="${esc(o.id)}">Ouvrir le dossier</button>`);
      marker.on("popupopen", (event) => {
        const button = event.popup.getElement()?.querySelector(".setom-map-open");
        button?.addEventListener("click", () => openOSFromMap(o.id, osLabel(o)), { once: true });
      });
    });
    if (bounds.length === 1) map.setView(bounds[0], 15);
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
  }, [points]);

  async function trace() {
    if (points.length < 2) { setMessage("Il faut au moins deux OS géolocalisés et planifiés pour tracer la tournée."); return; }
    const map = mapRef.current, layer = routeRef.current;
    if (!map || !layer) return;
    setRouting(true); setMessage("Calcul de l’itinéraire routier…"); layer.clearLayers();
    const controller = new AbortController();
    try {
      const coordinates = points.map((o) => `${Number(o.longitude)},${Number(o.latitude)}`).join(";");
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`service routier indisponible (${response.status})`);
      const result = await response.json();
      if (result.code !== "Ok" || !result.routes?.[0]) throw new Error("aucun itinéraire trouvé");
      const route = result.routes[0];
      L.geoJSON(route.geometry, { style: { color: "#086fba", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" } }).addTo(layer);
      const bounds = L.geoJSON(route.geometry).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
      setMessage(`Tournée calculée : ${(route.distance / 1000).toFixed(1)} km · ${Math.round(route.duration / 60)} min de conduite.`);
    } catch (e) {
      if (e?.name !== "AbortError") setMessage("Calcul d’itinéraire impossible : " + (e?.message || "erreur réseau"));
    } finally { setRouting(false); }
  }

  return <div className="setom-operational-map-shell">
    <div className="setom-operational-map-toolbar">
      <label><CalendarDays size={15}/> Journée<input type="date" value={date} onChange={(e) => setDate(e.target.value)}/></label>
      <div className="setom-map-summary"><b>{points.length} repère(s)</b><span>{scheduled.length} OS planifié(s) · {unlocated} sans coordonnées</span></div>
      <button type="button" onClick={trace} disabled={routing || points.length < 2}><Route size={15}/>{routing ? "Calcul…" : "Tracer la tournée"}</button>
      <button type="button" className="secondary" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? "setom-spin" : ""}/> Actualiser</button>
    </div>
    {message && <div className="setom-operational-map-message"><MapPin size={15}/>{message}<button type="button" onClick={() => setMessage("")}><X size={14}/></button></div>}
    <div className="setom-operational-map-info"><span><b>Repères numérotés</b> = ordre de tournée</span><span><b>Cliquer</b> sur un repère pour ouvrir le dossier</span>{unlocated > 0 && <span className="warning">{unlocated} OS planifié(s) sans coordonnées</span>}</div>
    <div className="setom-operational-map-canvas" ref={mapEl}/>
  </div>;
}
