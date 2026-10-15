// Classeur: clicking the OS label opens the existing OS detail modal.
// Kept outside the workflow layer so it does not alter OS data or statuses.
(function installClasseurNavigation() {
  function getOsNumberFromRow(row) {
    // In both the daily and weekly binder, the OS label is the strong element.
    const label = row?.querySelector("strong");
    const text = String(label?.textContent || "").trim();
    return text;
  }

  function openOsFromBinder(osNumber) {
    if (!osNumber) return;

    // Close the planning overlay first, then let the dashboard navigation helper
    // open the normal OS page/modal. No data or workflow status is changed here.
    const closeButton = document.querySelector(".setom-planner-header>button");
    if (closeButton) closeButton.click();

    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("setom:open-os-from-classeur", {
        detail: { osNumber }
      }));
    }, 150);
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    const row = target?.closest?.(".setom-binder-card, .setom-week-binder-row");
    if (!row) return;

    // Only the OS label is an opening target. Other controls in the binder
    // (buttons/selects) keep their normal behavior.
    const label = target.closest?.("strong");
    if (!label || !row.contains(label)) return;

    const osNumber = getOsNumberFromRow(row);
    if (!osNumber) return;

    event.preventDefault();
    event.stopPropagation();
    openOsFromBinder(osNumber);
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .setom-binder-card strong,
    .setom-week-binder-row strong {
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .setom-binder-card strong:hover,
    .setom-week-binder-row strong:hover {
      opacity: .75;
    }
  `;
  document.head.appendChild(style);
})();
