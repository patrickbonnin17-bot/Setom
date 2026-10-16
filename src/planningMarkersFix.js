import L from "leaflet";
import { supabase } from "./supabase";

const MAP_SELECTOR = ".setom-map-canvas";
const capturedMaps = new WeakMap();
const markerLayers = new WeakMap();
const refreshTimers = new WeakMap();

function osNumberFromLabel(value) {
  const match = String(value || "").match(/-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function markerIcon(order) {
  const number = String(order.os_number).padStart(2, "0");
  const color = order.status === "Planifié" ? "#2563eb" : "#dc2626";
  return L.divIcon({
    className: "setom-planning-os-marker-wrap",
    html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 3px 10px rgba(15,23,42,.28);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font:800 11px/1 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${number}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34]
  });
}

function installStyles() {
  if (document.getElementById("setom-planning-markers-fix-style")) return;
  const style = document.createElement("style");
  style.id = "setom-planning-markers-fix-style";
  style.textContent = `
    .setom-planning-os-marker-wrap{background:transparent!important;border:0!important}
    .setom-planning-os-marker-wrap:hover{filter:brightness(.96);z-index:9999!important}
  `;
  document.head.appendChild(style);
}

function visibleOrderNumbers(container) {
  return new Set(
    Array.from(document.querySelectorAll(".setom-map-order strong"))
      .map((node) => osNumberFromLabel(node.textContent))
      .filter((value) => Number.isFinite(value))
  );
}

async function refreshMarkers(map, container) {
  if (!document.body.contains(container) || !map) return;
  const visibleNumbers = visibleOrderNumbers(container);
  if (!visibleNumbers.size) return;

  const { data, error } = await supabase
    .from("work_orders")
    .select("id, os_number, creation_date, address, postal_code, city, latitude, longitude, status")
    .in("os_number", Array.from(visibleNumbers));

  if (error) {
    console.warn("SETOM : impossible de charger les coordonnées des OS pour la carte", error);
    return;
  }

  let layer = markerLayers.get(container);
  if (!layer) {
    layer = L.layerGroup().addTo(map);
    markerLayers.set(container, layer);
  }
  layer.clearLayers();

  const points = [];
  for (const order of data || []) {
    const lat = Number(order.latitude);
    const lon = Number(order.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const address = [order.address, order.postal_code, order.city].filter(Boolean).join(", ");
    const marker = L.marker([lat, lon], { icon: markerIcon(order), riseOnHover: true }).addTo(layer);
    marker.bindPopup(`<strong>OS-${String(order.os_number).padStart(5, "0")}</strong><br>${address.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`);
    points.push([lat, lon]);
  }

  if (points.length) {
    map.fitBounds(points, { padding: [45, 45], maxZoom: points.length === 1 ? 15 : 14 });
  }
}

function captureMap(map) {
  const container = map.getContainer();
  if (!container?.matches(MAP_SELECTOR)) return;
  capturedMaps.set(container, map);
  const run = () => {
    refreshMarkers(map, container).catch((error) => console.warn("SETOM : erreur des marqueurs de planning", error));
  };
  setTimeout(run, 100);
  setTimeout(run, 700);
  setTimeout(run, 1800);
}

installStyles();

if (L.Map && typeof L.Map.addInitHook === "function") {
  L.Map.addInitHook(function captureSetomPlanningMap() {
    captureMap(this);
  });
}

function scan() {
  for (const container of document.querySelectorAll(MAP_SELECTOR)) {
    const map = capturedMaps.get(container);
    if (!map) continue;
    const current = refreshTimers.get(container);
    if (current) clearTimeout(current);
    refreshTimers.set(container, setTimeout(() => {
      refreshMarkers(map, container).catch((error) => console.warn("SETOM : erreur de rafraîchissement des marqueurs", error));
    }, 80));
  }
}

const observer = new MutationObserver(scan);
observer.observe(document.body, { childList: true, subtree: true });
setInterval(scan, 1500);
