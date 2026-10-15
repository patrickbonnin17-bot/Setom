// Dashboard cards: open the OS list filtered to the OS represented by the clicked counter.
// This stays isolated from the main workflow so dashboard navigation cannot alter OS data.
(function installDashboardNavigation() {
  const filters = {
    "OS actifs": "__ACTIVE__",
    "À planifier": "À planifier",
    "Travaux en cours": "Travaux en cours",
    "À facturer": "__BILLING__",
    "Validation": "__VALIDATION__",
    "Réserves": "__RESERVES__",
    "OS en erreur": "En erreur",
  };

  function getCardLabel(card) {
    const first = card?.querySelector("div");
    return String(first?.textContent || "").trim();
  }

  function selectStatus(value) {
    const selects = Array.from(document.querySelectorAll("select"));
    const statusSelect = selects.find((select) => Array.from(select.options).some((option) => option.value === "À planifier"));
    if (!statusSelect) return false;

    const optionExists = Array.from(statusSelect.options).some((option) => option.value === value);
    if (!optionExists) return false;
    statusSelect.value = value;
    statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function openOSFilter(label) {
    const navButton = Array.from(document.querySelectorAll("nav button"))
      .find((button) => String(button.textContent || "").includes("Ordres") || String(button.textContent || "").includes("OS"));
    if (!navButton) return;
    navButton.click();

    window.setTimeout(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      const statusSelect = selects.find((select) => Array.from(select.options).some((option) => option.value === "À planifier"));
      if (!statusSelect) return;

      if (label === "__ACTIVE__") {
        // Keep the complete active list visible.
        const tous = Array.from(statusSelect.options).find((option) => option.value === "Tous");
        if (tous) {
          statusSelect.value = "Tous";
          statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }

      if (label === "__BILLING__") {
        // Facturation can contain two workflow statuses; use the search box to avoid hiding one of them.
        const search = document.querySelector('input[placeholder*="Rechercher OS"]');
        if (search) {
          search.value = "";
          search.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return;
      }

      if (label === "__VALIDATION__") {
        // Validation is represented by the constat-validation workflow states.
        // Keep the OS page open and let the user see the matching cards without changing the DB.
        return;
      }

      if (label === "__RESERVES__") return;
      selectStatus(label);
    }, 80);
  }

  document.addEventListener("click", (event) => {
    const card = event.target.closest?.(".cards .card");
    if (!card) return;
    const label = getCardLabel(card);
    if (!filters[label]) return;
    event.preventDefault();
    event.stopPropagation();
    openOSFilter(filters[label]);
  }, true);

  const style = document.createElement("style");
  style.textContent = ".cards .card { cursor: pointer; } .cards .card:hover { transform: translateY(-1px); }";
  document.head.appendChild(style);
})();
