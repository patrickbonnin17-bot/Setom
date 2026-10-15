// Classeur: clicking an OS opens the existing OS detail modal.
// Kept outside the workflow layer so it does not alter OS data or statuses.
(function installClasseurNavigation() {
  function getOsNumberFromRow(row) {
    const strong = row?.querySelector("strong");
    const text = String(strong?.textContent || row?.textContent || "").trim();
    return text;
  }

  function openOsFromBinder(osNumber) {
    if (!osNumber) return;
    // Close the planning overlay first, then let the dashboard navigation helper
    // open the normal OS page/modal without duplicating the OS detail UI.
    const closeButton = document.querySelector(".setom-planner-header button");
    if (closeButton) closeButton.click();
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("setom:open-os-from-classeur", {
        detail: { osNumber }
      }));
    }, 100);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("button, select, input, a")) return;
    const row = event.target.closest?.(".setom-binder-card, .setom-week-binder-row");
    if (!row) return;
    const osNumber = getOsNumberFromRow(row);
    if (!osNumber) return;
    event.preventDefault();
    event.stopPropagation();
    openOsFromBinder(osNumber);
  }, true);

  const style = document.createElement("style");
  style.textContent = ".setom-binder-card, .setom-week-binder-row { cursor: pointer; } .setom-binder-card:hover, .setom-week-binder-row:hover { filter: brightness(.98); }";
  document.head.appendChild(style);
})();
