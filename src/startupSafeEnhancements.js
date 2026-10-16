import { supabase } from "./supabase";

const GEOCODE_CACHE_KEY = "setom-geocodes-v2";
const GEOCODE_DELAY_MS = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clean(value) {
  return String(value ?? "").trim();
}

function buildGeocodeQuery(row) {
  return [clean(row.address), clean(row.postal_code), clean(row.city), "France"]
    .filter(Boolean)
    .join(", ");
}

function readGeocodeCache() {
  try {
    return JSON.parse(sessionStorage.getItem(GEOCODE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeGeocodeCache(cache) {
  try {
    sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Cache is only an optimisation.
  }
}

async function geocodeQuery(query) {
  const response = await fetch(
    `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(query)}&limit=1`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`Géocodage HTTP ${response.status}`);
  const payload = await response.json();
  const coordinates = payload?.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [longitude, latitude] = coordinates.map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

async function geocodeMissingOS() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return;

  const { data: rows, error } = await supabase
    .from("work_orders")
    .select("id, address, postal_code, city, latitude, longitude")
    .or("latitude.is.null,longitude.is.null")
    .order("creation_date", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[SETOM] Géolocalisation automatique indisponible :", error.message);
    return;
  }

  const cache = readGeocodeCache();
  let updated = 0;

  for (const row of rows || []) {
    const query = buildGeocodeQuery(row);
    if (!query) continue;

    let position = cache[query] || null;
    if (!position) {
      try {
        position = await geocodeQuery(query);
        if (position) cache[query] = position;
      } catch (error) {
        console.warn("[SETOM] Géocodage impossible pour", query, error);
      }
      await sleep(GEOCODE_DELAY_MS);
    }

    if (!position) continue;

    const { error: updateError } = await supabase
      .from("work_orders")
      .update({ latitude: position.latitude, longitude: position.longitude })
      .eq("id", row.id);

    if (!updateError) updated += 1;
    else console.warn("[SETOM] Coordonnées non enregistrées pour", row.id, updateError.message);
  }

  writeGeocodeCache(cache);
  if (updated > 0) {
    window.dispatchEvent(new CustomEvent("setom:geolocation-updated", { detail: { count: updated } }));
    window.dispatchEvent(new CustomEvent("setom:planning-updated"));
  }
}

let geocodeTimer = null;
function scheduleGeocoding() {
  clearTimeout(geocodeTimer);
  geocodeTimer = setTimeout(() => {
    geocodeMissingOS().catch((error) => console.warn("[SETOM] Géolocalisation automatique :", error));
  }, 700);
}

async function loadEnhancements() {
  // Load the workflow unlock first so the Travaux UI is ready before the
  // finance/forecast overlays start observing and decorating the page.
  const modules = [
    "./workFormInteractionFix.js",
    "./dailyFinanceControlOverlay.js",
    "./dailyForecastControlOverlay.js",
  ];

  for (const modulePath of modules) {
    try {
      await import(modulePath);
    } catch (error) {
      console.error(`[SETOM] Module complémentaire non chargé: ${modulePath}`, error);
    }
  }

  scheduleGeocoding();
}

window.addEventListener("setom:planning-updated", scheduleGeocoding);
window.addEventListener("setom:os-created", scheduleGeocoding);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadEnhancements, { once: true });
} else {
  loadEnhancements();
}
