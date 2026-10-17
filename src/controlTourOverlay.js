import { supabase } from "./supabase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

(function installControlTour() {
  let root = null;
  let map = null;
  let layer = null;
  let routeLayer = null;
  let orders = [];
  let selected = new Set();
  let mode = "control";

  const esc = (v) => String(v ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const label = (o) => `${String(o.os_number).padStart(5, "0")} · ${o.address || "Adresse inconnue"}${o.city ? `, ${o.city}` : ""}`;

  function ensureStyles() {
    if (document.getElementById("setom-control-tour-style")) return;
    const style = document.createElement("style");
    style.id = "setom-control-tour-style";
    style.textContent = `
      .setom-control-tour-launch{border:1px solid rgba(255,255,255,.25)!important;background:rgba(255,255,255,.13)!important;color:#fff!important;font-weight:800!important}
      .setom-control-tour-backdrop{position:fixed;inset:0;z-index:2147482000;background:rgba(9,25,48,.62);backdrop-filter:blur(7px);display:flex;align-items:center;justify-content:center;padding:18px}
      .setom-control-tour{width:min(1180px,100%);height:min(820px,94vh);background:#f7f9fc;border-radius:22px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35);display:grid;grid-template-rows:auto 1fr;color:#172033}
      .setom-control-tour-head{background:linear-gradient(135deg,#08284f,#1261b6);color:#fff;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px}
      .setom-control-tour-head h2{margin:0;font-size:20px}.setom-control-tour-head p{margin:5px 0 0;opacity:.8;font-size:13px}.setom-control-tour-head button{background:transparent;border:0;color:#fff;font-size:24px;cursor:pointer}
      .setom-control-tour-body{display:grid;grid-template-columns:380px 1fr;min-height:0}.setom-control-tour-list{overflow:auto;padding:16px;background:#fff;border-right:1px solid #dbe3ee}.setom-control-tour-map{min-width:0;position:relative}.setom-control-tour-map-canvas{height:100%;width:100%;min-height:420px}
      .setom-control-tour-actions{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.setom-control-tour-actions button{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 10px;font-weight:700;cursor:pointer}.setom-control-tour-actions .primary{background:#1261b6;color:#fff;border-color:#1261b6}.setom-control-tour-actions .danger{color:#b42318}
      .setom-control-tour-filter{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px}.setom-control-tour-filter button{padding:8px;border:1px solid #d5dce7;background:#f7f9fc;border-radius:9px;cursor:pointer;font-weight:700}.setom-control-tour-filter button.active{background:#e7f0ff;border-color:#1261b6;color:#1261b6}
      .setom-control-tour-card{border:1px solid #dce3ec;border-radius:12px;padding:10px;margin:7px 0;background:#fff}.setom-control-tour-card.selected{border-color:#1261b6;background:#f1f7ff}.setom-control-tour-card label{display:flex;gap:9px;align-items:flex-start;cursor:pointer}.setom-control-tour-card strong{display:block;font-size:13px}.setom-control-tour-card small{display:block;color:#667085;margin-top:3px}.setom-control-tour-status{display:inline-block;margin-top:6px;border-radius:999px;padding:3px 7px;font-size:11px;font-weight:800;background:#fff1d6;color:#8a5300}
      .setom-control-tour-summary{background:#eef5ff;border:1px solid #cfe0fa;border-radius:11px;padding:10px;margin-bottom:12px;font-size:13px}.setom-control-tour-stop{position:absolute;z-index:500;background:#fff;border:1px solid #d5dce7;border-radius:12px;box-shadow:0 10px 25px rgba(16,24,40,.16);padding:10px;left:16px;right:16px;bottom:16px;display:none}.setom-control-tour-stop strong{display:block}.setom-control-tour-stop-actions{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap}.setom-control-tour-stop-actions button{border:0;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:800}.setom-control-tour-stop-actions .ok{background:#dff7e8;color:#087443}.setom-control-tour-stop-actions .hold{background:#fff0d8;color:#8a5300}.setom-control-tour-stop-actions .new{background:#ffe5e2;color:#b42318}
      @media(max-width:800px){.setom-control-tour-backdrop{padding:0}.setom-control-tour{height:100vh;border-radius:0}.setom-control-tour-body{grid-template-columns:1fr;grid-template-rows:48% 52%}.setom-control-tour-list{border-right:0;border-bottom:1px solid #dbe3ee}.setom-control-tour-map-canvas{min-height:0}.setom-control-tour-head{padding:14px 16px}.setom-control-tour-head h2{font-size:17px}}
    `;
    document.head.appendChild(style);
  }

  async function loadOrders() {
    const { data, error } = await supabase.from("work_orders").select("id, os_number, creation_date, address, postal_code, city, latitude, longitude, status, deadline_date, material_detail, planned_surface_m2").order("os_number", { ascending: true });
    if (error) throw error;
    orders = (data || []).filter((o) => Number.isFinite(Number(o.latitude)) && Number.isFinite(Number(o.longitude)));
    renderList();
    refreshMap();
  }

  function candidates() {
    if (mode === "control") return orders.filter((o) => o.status === "Réserve" || o.status === "À vérifier");
    return orders.filter((o) => !["Payé", "Validé"].includes(o.status));
  }

  function renderList() {
    if (!root) return;
    const list = candidates();
    root.querySelector(".setom-control-tour-items").innerHTML = list.length ? list.map((o) => `
      <div class="setom-control-tour-card ${selected.has(o.id) ? "selected" : ""}">
        <label><input type="checkbox" data-control-id="${esc(o.id)}" ${selected.has(o.id) ? "checked" : ""}><span><strong>${esc(label(o))}</strong><small>${esc(o.material_detail || "Intervention")} ${o.planned_surface_m2 ? `· ${esc(o.planned_surface_m2)} m²` : ""}</small><span class="setom-control-tour-status">${esc(o.status)}</span></span></label>
      </div>`).join("") : `<p style="color:#667085">Aucune adresse correspondant à ce filtre.</p>`;
    root.querySelector(".setom-control-tour-summary").textContent = `${selected.size} arrêt(s) sélectionné(s). Les OS contrôlés ne sont pas ajoutés à la tournée d’une équipe.`;
  }

  function refreshMap() {
    if (!map || !layer) return;
    layer.clearLayers();
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    const points = [...selected].map((id) => orders.find((o) => o.id === id)).filter(Boolean);
    const bounds = [];
    points.forEach((o, i) => {
      const p = [Number(o.latitude), Number(o.longitude)]; bounds.push(p);
      L.marker(p).bindPopup(`<strong>${i + 1}. ${esc(label(o))}</strong><br>${esc(o.status)}`).addTo(layer);
    });
    if (bounds.length === 1) map.setView(bounds[0], 14);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [35, 35] });
  }

  async function optimizeRoute() {
    const points = [...selected].map((id) => orders.find((o) => o.id === id)).filter(Boolean);
    if (points.length < 2) return;
    const coords = points.map((o) => `${o.longitude},${o.latitude}`).join(";");
    root.querySelector(".setom-control-tour-summary").textContent = "Calcul de l’ordre optimal…";
    try {
      const response = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coords}?roundtrip=false&source=first&destination=last&overview=full&geometries=geojson`);
      if (!response.ok) throw new Error("OSRM indisponible");
      const payload = await response.json();
      const waypoints = payload?.waypoints || [];
      const ordered = waypoints.slice().sort((a,b) => Number(a.waypoint_index) - Number(b.waypoint_index)).map((w) => points[w.trips_index ?? points.findIndex((p) => Math.abs(Number(p.longitude)-w.location[0])<1e-6 && Math.abs(Number(p.latitude)-w.location[1])<1e-6)]).filter(Boolean);
      if (ordered.length === points.length) selected = new Set(ordered.map((o) => o.id));
      if (payload?.trips?.[0]?.geometry?.coordinates?.length) {
        const latLngs = payload.trips[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
        routeLayer = L.polyline(latLngs, { color: "#1261b6", weight: 5, opacity: .85 }).addTo(map);
        map.fitBounds(routeLayer.getBounds(), { padding: [35, 35] });
        const km = (Number(payload.trips[0].distance || 0) / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
        const min = Math.round(Number(payload.trips[0].duration || 0) / 60);
        root.querySelector(".setom-control-tour-summary").textContent = `${points.length} arrêts · ${km} km · environ ${min} min de conduite.`;
      }
      renderList();
    } catch (e) { root.querySelector(".setom-control-tour-summary").textContent = "Impossible de calculer l’itinéraire pour le moment. Les adresses restent sélectionnées."; }
  }

  async function recordOutcome(order, outcome) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;
    const { error } = await supabase.from("control_tour_visits").insert({ work_order_id: order.id, outcome, visited_by: auth.user.id });
    if (error) { alert("Impossible d’enregistrer le contrôle : " + error.message); return; }
    if (outcome === "À remettre en tournée") {
      const { error: updateError } = await supabase.from("work_orders").update({ status: "À planifier" }).eq("id", order.id);
      if (updateError) { alert("Le contrôle est enregistré, mais la remise en tournée a échoué : " + updateError.message); return; }
    }
    selected.delete(order.id); await loadOrders();
    const stop = root.querySelector(".setom-control-tour-stop"); if (stop) stop.style.display = "none";
  }

  function openOs(order) {
    window.dispatchEvent(new CustomEvent("setom:open-os-from-classeur", { detail: { osNumber: `${String(order.os_number).padStart(5, "0")}` } }));
  }

  function open() {
    if (root) return;
    ensureStyles();
    root = document.createElement("div"); root.className = "setom-control-tour-backdrop";
    root.innerHTML = `<section class="setom-control-tour" role="dialog" aria-modal="true">
      <header class="setom-control-tour-head"><div><h2>🧭 Ma tournée de contrôle</h2><p>Réserves, adresses à vérifier et OS sélectionnés manuellement</p></div><button data-close>×</button></header>
      <div class="setom-control-tour-body"><aside class="setom-control-tour-list">
        <div class="setom-control-tour-actions"><button class="primary" data-route>🚗 Optimiser ma tournée</button><button data-select-all>Tout sélectionner</button><button data-clear>Effacer</button></div>
        <div class="setom-control-tour-filter"><button class="active" data-mode="control">Réserves / à vérifier</button><button data-mode="manual">Sélection manuelle</button></div>
        <div class="setom-control-tour-summary">0 arrêt sélectionné.</div><div class="setom-control-tour-items"></div>
      </aside><div class="setom-control-tour-map"><div class="setom-control-tour-map-canvas"></div><div class="setom-control-tour-stop"></div></div></div></section>`;
    document.body.appendChild(root);
    map = L.map(root.querySelector(".setom-control-tour-map-canvas"), { zoomControl: true }).setView([43.6045, 1.444], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
    layer = L.layerGroup().addTo(map);
    root.addEventListener("click", async (e) => {
      if (e.target.matches("[data-close]") || e.target === root) return close();
      const checkbox = e.target.closest("[data-control-id]");
      if (checkbox) { const id = checkbox.dataset.controlId; checkbox.checked ? selected.add(id) : selected.delete(id); renderList(); refreshMap(); return; }
      const modeButton = e.target.closest("[data-mode]");
      if (modeButton) { mode = modeButton.dataset.mode; root.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("active", b === modeButton)); renderList(); return; }
      if (e.target.closest("[data-select-all]")) { candidates().forEach((o) => selected.add(o.id)); renderList(); refreshMap(); return; }
      if (e.target.closest("[data-clear]")) { selected.clear(); renderList(); refreshMap(); return; }
      if (e.target.closest("[data-route]")) return optimizeRoute();
      const card = e.target.closest(".setom-control-tour-card");
      if (card && !e.target.matches("input")) { const id = card.querySelector("input")?.dataset.controlId; const o = orders.find((x) => x.id === id); if (!o) return; const stop = root.querySelector(".setom-control-tour-stop"); stop.style.display = "block"; stop.innerHTML = `<strong>${esc(label(o))}</strong><small>${esc(o.status)}</small><div class="setom-control-tour-stop-actions"><button data-open class="ok">Ouvrir l’OS</button><button data-outcome="À remettre en tournée" class="ok">Remettre en tournée</button><button data-outcome="Maintenir en réserve" class="hold">Maintenir en réserve</button><button data-outcome="Nouvelle intervention nécessaire" class="new">Nouvelle intervention</button></div>`; stop.dataset.orderId = o.id; return; }
      const stop = e.target.closest(".setom-control-tour-stop"); if (stop?.dataset.orderId) { const o = orders.find((x) => x.id === stop.dataset.orderId); if (!o) return; if (e.target.closest("[data-open]")) return openOs(o); const outcome = e.target.closest("[data-outcome]")?.dataset.outcome; if (outcome) return recordOutcome(o, outcome); }
    });
    loadOrders().catch((e) => { root.querySelector(".setom-control-tour-items").innerHTML = `<p>Erreur de chargement : ${esc(e.message)}</p>`; });
  }

  function close() { if (map) map.remove(); if (root) root.remove(); root = null; map = null; layer = null; routeLayer = null; selected.clear(); }

  const observer = new MutationObserver(() => {
    const tabs = document.querySelector(".setom-plan-tabs");
    if (!tabs || tabs.querySelector(".setom-control-tour-launch")) return;
    const button = document.createElement("button"); button.className = "setom-control-tour-launch"; button.textContent = "🧭 Contrôle"; button.title = "Préparer ma tournée de contrôle"; button.addEventListener("click", open); tabs.appendChild(button);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
