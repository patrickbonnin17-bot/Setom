from pathlib import Path

path = Path("src/planningOverlay.jsx")
text = path.read_text(encoding="utf-8")

old = '''  useEffect(() => {
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
  }, [view]);'''

new = '''  useEffect(() => {
    if (view !== "carte") return;
    let cancelled = false;
    let map = null;
    let retryTimer = null;
    let resizeObserver = null;

    const invalidateMapSize = () => {
      const currentMap = map || mapInstanceRef.current;
      const element = mapElementRef.current;
      if (!currentMap || !element) return;
      requestAnimationFrame(() => {
        try { currentMap.invalidateSize({ pan: false, animate: false }); } catch { /* map may be unmounted */ }
      });
    };

    const ensureMap = () => {
      if (cancelled || map || mapInstanceRef.current) return;
      const element = mapElementRef.current;
      if (!element || element.clientWidth < 20 || element.clientHeight < 20) {
        retryTimer = window.setTimeout(ensureMap, 100);
        return;
      }
      try {
        map = L.map(element, { zoomControl: true, scrollWheelZoom: true }).setView([43.6045, 1.444], 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>' }).addTo(map);
        const markers = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        markerLayerRef.current = markers;
        map.whenReady(() => {
          invalidateMapSize();
          [50, 150, 300, 700, 1200].forEach((delay) => window.setTimeout(invalidateMapSize, delay));
        });
        invalidateMapSize();
      } catch (error) {
        console.error("SETOM: initialisation Leaflet impossible dans l'onglet Carte", error);
        setMapStatus("La carte rencontre un problème d'affichage. Nouvelle tentative…");
        map = null;
        mapInstanceRef.current = null;
        markerLayerRef.current = null;
        retryTimer = window.setTimeout(ensureMap, 300);
      }
    };

    const refreshMapSize = () => {
      if (map) invalidateMapSize();
      else ensureMap();
    };

    requestAnimationFrame(() => requestAnimationFrame(ensureMap));
    [50, 150, 300, 700, 1200].forEach((delay) => window.setTimeout(ensureMap, delay));
    resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(refreshMapSize) : null;
    if (resizeObserver && mapElementRef.current) resizeObserver.observe(mapElementRef.current);
    window.addEventListener("resize", refreshMapSize);
    window.addEventListener("orientationchange", refreshMapSize);
    window.addEventListener("setom:map-refresh", refreshMapSize);

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", refreshMapSize);
      window.removeEventListener("orientationchange", refreshMapSize);
      window.removeEventListener("setom:map-refresh", refreshMapSize);
      if (map) {
        try { map.remove(); } catch { /* already removed */ }
      }
      map = null;
      mapInstanceRef.current = null;
      markerLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, [view]);'''

if old not in text:
    raise SystemExit("Expected Leaflet map effect not found; refusing to patch.")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("Leaflet mobile stability patch applied")
