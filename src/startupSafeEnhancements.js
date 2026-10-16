function loadEnhancements() {
  const modules = [
    "./workFormInteractionFix.js",
    "./dailyFinanceControlOverlay.js",
    "./dailyForecastControlOverlay.js",
  ];
  modules.forEach((modulePath) => {
    import(modulePath).catch((error) => {
      console.error(`[SETOM] Module complémentaire non chargé: ${modulePath}`, error);
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadEnhancements, { once: true });
} else {
  loadEnhancements();
}
