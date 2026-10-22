import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TOULOUSE = [43.6047, 1.4442];
const OSRM = "https://router.project-osrm.org/route/v1/driving";

function makeMarker(number, active = false) {
  return L.divIcon({
    className: "setom-map-marker-wrap",
    html: `<div class="setom-map-marker ${active ? "active" : ""}">${number ?? ""}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

export default function GoogleMap({ points = [], routePoints = [], height = 420, onSelect, showRoute = false, className = "" }) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const routeRef = useRef(null);
  const [routeError, setRouteError] = useState("");

  const validPoints = useMemo(() => points.filter(p => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))), [points]);
  const validRoute = useMemo(() => routePoints.filter(p => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude))), [routePoints]);

  useEffect(() => {
    if (!nodeRef.current || mapRef.current) return;
    const map = L.map(nodeRef.current, { zoomControl: true, preferCanvas: true, scrollWheelZoom: true }).setView(TOULOUSE, 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 50);
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    validPoints.forEach((point, index) => {
      const marker = L.marker([Number(point.latitude), Number(point.longitude)], {
        icon: makeMarker(point.order ?? index + 1, point.active),
      }).addTo(map);
      marker.bindPopup(`<strong>${point.os_number || "OS"}</strong><br/>${point.title || "Chantier"}`);
      marker.on("click", () => onSelect?.(point));
      markersRef.current.push(marker);
    });
    if (validPoints.length) {
      const bounds = L.latLngBounds(validPoints.map(p => [Number(p.latitude), Number(p.longitude)]));
      map.fitBounds(bounds.pad(validPoints.length === 1 ? 0.35 : 0.12), { maxZoom: 15 });
    } else map.setView(TOULOUSE, 11);
  }, [validPoints, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    setRouteError("");
    if (routeRef.current) { routeRef.current.remove(); routeRef.current = null; }
    if (!showRoute || validRoute.length < 2) return;

    const coords = validRoute.map(p => `${Number(p.longitude)},${Number(p.latitude)}`).join(";");
    fetch(`${OSRM}/${coords}?overview=full&geometries=geojson&steps=false`)
      .then(r => { if (!r.ok) throw new Error("Routage routier indisponible"); return r.json(); })
      .then(result => {
        if (cancelled) return;
        const geometry = result?.routes?.[0]?.geometry;
        if (!geometry?.coordinates?.length) throw new Error("Aucun itinéraire routier trouvé");
        const latLngs = geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        routeRef.current = L.polyline(latLngs, { color: "#1267c4", weight: 5, opacity: 0.9, lineCap: "round", lineJoin: "round" }).addTo(map);
        map.fitBounds(routeRef.current.getBounds().pad(0.08), { maxZoom: 15 });
      })
      .catch(error => { if (!cancelled) setRouteError(error.message); });
    return () => { cancelled = true; };
  }, [validRoute, showRoute]);

  return <div className={`setom-google-map ${className}`} style={{ minHeight: height, position: "relative" }}>
    <style>{`.setom-map-marker-wrap{background:transparent!important;border:0!important}.setom-map-marker{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#1267c4;color:#fff;border:3px solid #fff;box-shadow:0 3px 9px rgba(0,0,0,.28);font:800 12px Inter,system-ui,sans-serif}.setom-map-marker.active{background:#ffc400;color:#102a51}.setom-map-attribution-note{position:absolute;right:8px;bottom:8px;z-index:500;background:rgba(255,255,255,.92);padding:4px 7px;border-radius:4px;font-size:9px;color:#52657d;box-shadow:0 1px 4px rgba(0,0,0,.12)}.map-config-warning{position:absolute;left:16px;right:16px;top:16px;z-index:600;background:#fff4d7;border:1px solid #f2d48a;color:#7b5b00;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:3px;font-size:11px}.map-config-warning strong{font-size:12px}`}</style>
    <div ref={nodeRef} style={{ height: "100%", minHeight: height, borderRadius: 14, overflow: "hidden" }} />
    <div className="setom-map-attribution-note">Carte interactive · OpenStreetMap · routage routier OSRM</div>
    {routeError && <div className="map-config-warning"><strong>Routage temporairement indisponible</strong><span>{routeError}</span></div>}
  </div>;
}
