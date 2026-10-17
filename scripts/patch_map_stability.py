from pathlib import Path

path = Path("src/planningOverlay.jsx")
text = path.read_text(encoding="utf-8")

old = '    map.whenReady(() => map.invalidateSize());'
new = '''    const invalidateMapSize = () => {
      if (!mapElementRef.current) return;
      requestAnimationFrame(() => {
        try { map.invalidateSize({ pan: false, animate: false }); } catch { /* map may be unmounted */ }
      });
    };
    const refreshMapSize = () => {
      invalidateMapSize();
      [50, 150, 300, 700].forEach((delay) => window.setTimeout(invalidateMapSize, delay));
    };
    map.whenReady(refreshMapSize);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(refreshMapSize) : null;
    if (resizeObserver && mapElementRef.current) resizeObserver.observe(mapElementRef.current);
    window.addEventListener("resize", refreshMapSize);
    window.addEventListener("orientationchange", refreshMapSize);
    window.addEventListener("setom:map-refresh", refreshMapSize);
    refreshMapSize();'''

if old not in text:
    raise SystemExit("Expected Leaflet initialization marker not found; refusing to patch.")
text = text.replace(old, new, 1)

old_cleanup = '''    return () => {
      map.remove();'''
new_cleanup = '''    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", refreshMapSize);
      window.removeEventListener("orientationchange", refreshMapSize);
      window.removeEventListener("setom:map-refresh", refreshMapSize);
      map.remove();'''

if old_cleanup not in text:
    raise SystemExit("Expected Leaflet cleanup marker not found; refusing to patch.")
text = text.replace(old_cleanup, new_cleanup, 1)
path.write_text(text, encoding="utf-8")
print("Leaflet mobile stability patch applied")
