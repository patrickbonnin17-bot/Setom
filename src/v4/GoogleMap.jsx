import React, { useEffect, useRef, useState } from "react";

let googlePromise;
function loadGoogleMaps(apiKey) {
  if (!apiKey) return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY manquante"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googlePromise) return googlePromise;
  googlePromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-setom-google-maps="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.dataset.setomGoogleMaps = "1";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry`;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Google Maps n'a pas pu être chargé"));
    document.head.appendChild(script);
  });
  return googlePromise;
}

export default function GoogleMap({ points = [], routePoints = [], height = 420, onSelect, showRoute = false, className = "" }) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const routeRef = useRef(null);
  const [error, setError] = useState("");
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(apiKey).then((maps) => {
      if (cancelled || !nodeRef.current || mapRef.current) return;
      mapRef.current = new maps.Map(nodeRef.current, {
        center: { lat: 43.6047, lng: 1.4442 },
        zoom: 11,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "greedy",
      });
    }).catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (routeRef.current) {
      routeRef.current.setMap(null);
      routeRef.current = null;
    }
    const bounds = new maps.LatLngBounds();
    points.forEach((point, index) => {
      const lat = Number(point.latitude), lng = Number(point.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const marker = new maps.Marker({
        map,
        position: { lat, lng },
        label: { text: String(point.order ?? index + 1), color: "#ffffff", fontWeight: "800" },
        title: point.title || point.os_number || "OS",
      });
      marker.addListener("click", () => onSelect?.(point));
      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
    });
    if (points.some((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))) {
      map.fitBounds(bounds, 50);
      if (points.length === 1) map.setZoom(15);
    }

    if (showRoute && routePoints.length > 1) {
      const path = routePoints.map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude) })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (path.length > 1) {
        routeRef.current = new maps.Polyline({ path, geodesic: true, strokeColor: "#1267c4", strokeOpacity: 0.95, strokeWeight: 5, map });
      }
    }
  }, [points, routePoints, showRoute, onSelect]);

  return <div className={`setom-google-map ${className}`} style={{ minHeight: height }}>
    <div ref={nodeRef} style={{ height: "100%", minHeight: height, borderRadius: 14 }} />
    {error && <div className="map-config-warning"><strong>Google Maps à configurer</strong><span>{error}</span><small>Ajoutez VITE_GOOGLE_MAPS_API_KEY dans les variables d’environnement Vercel.</small></div>}
  </div>;
}
