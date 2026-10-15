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

  function getCardLabel(card) {
    return String(card?.querySelector(":scope > div:first-child")?.textContent || "").trim();
  }

  function isOsPage() {
    return Array.from(document.querySelectorAll("h2")).some((heading) => String(heading.textContent || "").trim() === "Ordres de service");
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
    if (!activeFilter || !isOsPage()) return;
    getOsCards().forEach((card) => {
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

  function openSpecificOS(osNumber) {
    activeFilter = null;
    const navButton = Array.from(document.querySelectorAll("nav button"))
      .find((button) => String(button.textContent || "").includes("📋 OS"));
    if (!navButton) return;
    navButton.click();

    const findAndClick = () => {
      const target = getOsCards().find((card) => String(card.textContent || "").includes(osNumber));
      if (!target) return false;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.click();
      return true;
    };

    if (findAndClick()) return;
    window.setTimeout(() => { if (!findAndClick()) window.setTimeout(findAndClick, 250); }, 100);
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

  // The planning/classeur helper emits this event after closing the planning overlay.
  // We then open the same OS detail modal used everywhere else in SETOM.
  window.addEventListener("setom:open-os-from-classeur", (event) => {
    const osNumber = String(event.detail?.osNumber || "").trim();
    if (osNumber) openSpecificOS(osNumber);
  });

  // React recreates the OS cards when the page changes. Reapply the selected dashboard view.
  const observer = new MutationObserver(() => {
    if (activeFilter) window.requestAnimationFrame(applyOsFilter);
  });
  observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });

  const style = document.createElement("style");
  style.textContent = ".cards .card { cursor: pointer; transition: transform .12s ease; } .cards .card:hover { transform: translateY(-1px); }";
  document.head.appendChild(style);
})();
