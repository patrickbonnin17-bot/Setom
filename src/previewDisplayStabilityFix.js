(() => {
  const dispatchResize = () => {
    try { window.dispatchEvent(new Event("resize")); } catch { /* no-op */ }
  };

  const scheduleMapResize = () => {
    dispatchResize();
    window.setTimeout(dispatchResize, 50);
    window.setTimeout(dispatchResize, 250);
    window.setTimeout(dispatchResize, 700);
  };

  const refreshOSOnce = () => {
    try { window.dispatchEvent(new Event("setom:planning-updated")); } catch { /* no-op */ }
  };

  const install = () => {
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("button");
      if (!button) return;
      const label = String(button.textContent || "").toLocaleLowerCase("fr-FR");
      if (label.includes("carte") || label.includes("planning") || label.includes("os")) scheduleMapResize();
    }, true);

    document.addEventListener("visibilitychange", scheduleMapResize);
    window.addEventListener("orientationchange", scheduleMapResize);

    let attempts = 0;
    const retryOS = window.setInterval(() => {
      attempts += 1;
      const hasOS = !!document.querySelector(".os-list .os");
      if (hasOS || attempts >= 6) {
        window.clearInterval(retryOS);
        return;
      }
      refreshOSOnce();
    }, 1200);

    scheduleMapResize();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
