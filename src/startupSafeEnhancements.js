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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadEnhancements, { once: true });
} else {
  loadEnhancements();
}
