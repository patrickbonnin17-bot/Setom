// Dashboard counters: navigate to the OS concerned by the clicked counter.
// This is intentionally isolated from the workflow/data layer: it only changes the OS list view.
(function installDashboardNavigation() {
  const filters = {
    "OS actifs": { type: "statuses", statuses: ["Nouveau", "À planifier", "Planifié", "En travaux", "Travaux en cours", "En erreur", "Travaux réalisés", "Constat à vérifier", "Travaux effectués", "Constat de facturation", "En attente de validation", "Validé", "Validé avec réserve", "Réserve", "Correction à réaliser", "Payé"] },
    "À planifier": { type: "statuses", statuses: ["À planifier"] },
    "Travaux en cours": { type: "statuses", statuses: ["En travaux", "Travaux en cours", "Travaux réalisés"] },
    "À facturer": { type: "statuses", statuses: ["Travaux effectués", "Constat de facturation"] },
    "Validation": { type: "statuses", statuses: ["En attente de validation", "Constat à vérifier", "Constat validé"] },
    "Réserves": { type: "reserve" },
    "OS en erreur": { type: "statuses", statuses: ["En erreur"] },
  };

  let activeFilter = null;
  let observer = null;

  function getCardLabel(card) {
    return String(card?.querySelector(":scope > div:first-child")?.textContent || "").trim();
  }

  function getOsCards() {
    return Array.from(document.querySelectorAll(".os-list .os"));
  }

  function getBadge(card) {
    return String(card.querySelector(".badge")?.textContent || "").trim();
  }

  function isCardMatch(card, filter) {
    if (!filter) return true;
    const badge = getBadge(card);
    if (filter.type === "statuses") return filter.statuses.includes(badge);
    if (filter.type === "reserve") return badge === "Réserve à lever" || badge === "Réserve" || badge === "Correction à réaliser";
    return true;
  }

  function applyOsFilter() {
    if (!activeFilter) return;
    const cards = getOsCards();
    if (!cards.length) return;
    cards.forEach((card) => {
      card.style.display = isCardMatch(card, activeFilter) ? "" : "none";
    });
  }

  function openOSFilter(filter) {
    activeFilter = filter;
    const navButton = Array.from(document.querySelectorAll("nav button"))
      .find((button) => String(button.textContent || "").includes("📋 OS"));
    if (!navButton) return;
    navButton.click();
    window.setTimeout(applyOsFilter, 80);
    window.setTimeout(applyOsFilter, 250);
  }

  document.addEventListener("click", (event) => {
    const card = event.target.closest?.(".cards .card");
    if (!card) return;
    const label = getCardLabel(card);
    const filter = filters[label];
    if (!filter) return;
    event.preventDefault();
    event.stopPropagation();
    openOSFilter(filter);
  }, true);

  // React recreates the OS cards when the page/filter changes. Reapply the dashboard filter
  // after each render without touching the underlying React state or database.
  observer = new MutationObserver(() => {
    if (activeFilter) window.requestAnimationFrame(applyOsFilter);
  });
  observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });

  const style = document.createElement("style");
  style.textContent = ".cards .card { cursor: pointer; transition: transform .12s ease; } .cards .card:hover { transform: translateY(-1px); }";
  document.head.appendChild(style);
})();
