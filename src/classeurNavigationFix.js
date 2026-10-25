import "./planningTasksEnhancement";

// Classeur: clicking the OS label opens the existing OS detail modal.
// The binder stays open underneath the modal so the team can return to it
// without losing the current day/week context.
(function installClasseurNavigation() {
  let plannerHost = null;
  let plannerOriginalZIndex = "";
  let modalOriginalZIndex = null;
  let modalWasOpened = false;
  let observer = null;

  function getOsNumberFromRow(row) {
    const label = row?.querySelector("strong");
    return String(label?.textContent || "").trim();
  }

  function prepareBinderBehindModal() {
    plannerHost = document.querySelector("#setom-planner-host");
    if (!plannerHost) return;

    plannerOriginalZIndex = plannerHost.style.zIndex || "";
    plannerHost.style.zIndex = "900";

    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      const modal = document.querySelector(".os-detail-modal");
      if (modal) {
        modalWasOpened = true;
        if (modalOriginalZIndex === null) modalOriginalZIndex = modal.style.zIndex || "";
        modal.style.zIndex = "2147483001";
        return;
      }

      if (modalWasOpened) restoreBinderLayer();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const existingModal = document.querySelector(".os-detail-modal");
    if (existingModal) {
      modalWasOpened = true;
      modalOriginalZIndex = existingModal.style.zIndex || "";
      existingModal.style.zIndex = "2147483001";
    }
  }

  function restoreBinderLayer() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (plannerHost && plannerHost.isConnected) {
      plannerHost.style.zIndex = plannerOriginalZIndex;
    }

    plannerHost = null;
    plannerOriginalZIndex = "";
    modalOriginalZIndex = null;
    modalWasOpened = false;
  }

  function openOsFromBinder(osNumber) {
    if (!osNumber) return;
    prepareBinderBehindModal();
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("setom:open-os-from-classeur", {
        detail: { osNumber }
      }));
    }, 100);
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    const row = target?.closest?.(".setom-binder-card, .setom-week-binder-row");
    if (!row) return;

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
