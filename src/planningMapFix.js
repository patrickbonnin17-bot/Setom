import L from "leaflet";
import "leaflet/dist/leaflet.css";

const MAP_SELECTOR = ".setom-map-canvas";
const instances = new WeakMap();

function addStyle() {
  if (document.getElementById("setom-planning-map-fix-style")) return;
  const style = document.createElement("style");
  style.id = "setom-planning-map-fix-style";
  style.textContent = `${MAP_SELECTOR}{width:100%!important;height:clamp(360px,62vh,760px)!important;min-height:360px!important;position:relative!important;overflow:hidden!important;background:#eaf0f6!important}${MAP_SELECTOR}.setom-map-fallback{display:flex;align-items:center;justify-content:center;background:#eaf0f6}.setom-map-fallback iframe{width:100%;height:100%;border:0}.setom-map-fallback-label{position:absolute;z-index:1000;left:10px;bottom:10px;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,.94);box-shadow:0 2px 10px rgba(15,23,42,.16);font:600 11px/1.3 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475569}`;
  document.head.appendChild(style);
}

function hasRenderedTiles(container) {
  return Boolean(container.querySelector(".leaflet-tile-container img.leaflet-tile, .leaflet-tile-pane .leaflet-tile"));
}

function dispatchResize() {
  window.dispatchEvent(new Event("resize"));
}

function invalidateExistingMap(container) {
  const instance = instances.get(container);
  if (instance?.map) {
    instance.map.invalidateSize({ pan: false });
    return;
  }
  dispatchResize();
}

async function geocodeFallback(address) {
  try {
    const params = new URLSearchParams({ q: `${address} France`, limit: "1" });
    const response = await fetch(`https://data.geopf.fr/geocodage/search?${params.toString()}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const payload = await response.json();
    const coords = payload?.features?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return { lat: Number(coords[1]), lon: Number(coords[0]) };
  } catch {
    return null;
  }
}

function readOrders() {
  return Array.from(document.querySelectorAll(".setom-map-order")).map((article) => {
    const strong = article.querySelector("strong");
    const span = article.querySelector("span");
    const input = article.querySelector("input[type='date']");
    const team = article.querySelector("select");
    return {
      id: strong?.textContent?.trim() || "OS",
      address: span?.textContent?.trim() || "",
      plannedDate: input?.value || "",
      teamId: team?.value || ""
    };
  }).filter((order) => order.address);
}

async function createFallbackMap(container) {
  if (!document.body.contains(container) || instances.get(container)?.fallback) return;
  const orders = readOrders();
  if (!orders.length) return;
  try {
    container.innerHTML = "";
    delete container._leaflet_id;
    const map = L.map(container, { zoomControl: true, scrollWheelZoom: true, preferCanvas: true }).setView([43.6045, 1.444], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    const points = [];
    for (const order of orders) {
      if (!document.body.contains(container)) break;
      const point = await geocodeFallback(order.address);
      if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      points.push([point.lat, point.lon]);
      const color = order.plannedDate ? "#2563eb" : "#dc2626";
      const marker = L.circleMarker([point.lat, point.lon], { radius: 8, color, weight: 2, fillColor: color, fillOpacity: .9 }).addTo(layer);
      marker.bindTooltip(`${order.id} · ${order.address}`, { direction: "top", opacity: .95 });
    }
    if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 14 });
    else if (points.length === 1) map.setView(points[0], 15);
    const badge = document.createElement("div");
    badge.className = "setom-map-fallback-label";
    badge.textContent = "Carte réparée automatiquement";
    container.appendChild(badge);
    instances.set(container, { map, observer: instances.get(container)?.observer || null, fallback: true });
    setTimeout(() => map.invalidateSize({ pan: false }), 50);
  } catch (error) {
    console.warn("SETOM : impossible d'initialiser le correctif cartographique", error);
    container.innerHTML = `<div class="setom-map-fallback"><iframe title="Carte SETOM" loading="lazy" src="https://www.openstreetmap.org/export/embed.html?bbox=1.35%2C43.53%2C1.57%2C43.68&layer=mapnik"></iframe><span class="setom-map-fallback-label">Fond cartographique de secours</span></div>`;
  }
}

function watchContainer(container) {
  if (instances.has(container)) return;
  const resizeObserver = new ResizeObserver(() => invalidateExistingMap(container));
  resizeObserver.observe(container);
  instances.set(container, { observer: resizeObserver, map: null, fallback: false });
  const repair = () => {
    if (!document.body.contains(container)) return;
    invalidateExistingMap(container);
    if (hasRenderedTiles(container)) return;
    if (container.querySelector(".leaflet-container")) return;
    createFallbackMap(container);
  };
  requestAnimationFrame(() => {
    dispatchResize();
    setTimeout(repair, 250);
    setTimeout(repair, 1000);
    setTimeout(repair, 2200);
  });
}

function cleanupDetached() {
  for (const container of document.querySelectorAll(MAP_SELECTOR)) watchContainer(container);
}

addStyle();
cleanupDetached();
const rootObserver = new MutationObserver(cleanupDetached);
rootObserver.observe(document.body, { childList: true, subtree: true });
setInterval(cleanupDetached, 1000);
