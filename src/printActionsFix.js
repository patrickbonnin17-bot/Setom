// Reliable, targeted print actions for the daily and weekly binders.
(function installPrintActions() {
  const PRINT_LABEL = /\bimprimer\b/i;
  const DAILY_CLASS = "setom-printing-daily-binder";
  const WEEK_CLASS = "setom-printing-week-binder";
  let cleanupTimer = null;

  function getPrintTarget(target) {
    const element = target?.closest?.('button, a, [role="button"], input[type="button"], input[type="submit"]');
    if (!element) return null;
    const label = String(element.textContent || element.value || element.getAttribute("aria-label") || "").trim();
    if (!PRINT_LABEL.test(label)) return null;
    const dailyBinder = element.closest(".setom-binder");
    const weekBinder = element.closest(".setom-week-binder");
    if (dailyBinder) return { element, mode: "daily" };
    if (weekBinder) return { element, mode: "week" };
    return null;
  }

  function clearPrintMode() {
    document.body.classList.remove(DAILY_CLASS, WEEK_CLASS);
    if (cleanupTimer) window.clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  function printBinder(mode) {
    clearPrintMode();
    document.body.classList.add(mode === "week" ? WEEK_CLASS : DAILY_CLASS);
    const previousTitle = document.title;
    document.title = mode === "week" ? "SETOM — Classeur hebdomadaire" : "SETOM — Classeur journalier";

    const afterPrint = () => {
      document.title = previousTitle;
      clearPrintMode();
      window.removeEventListener("afterprint", afterPrint);
    };
    window.addEventListener("afterprint", afterPrint);

    window.setTimeout(() => window.print(), 60);
    cleanupTimer = window.setTimeout(afterPrint, 15000);
  }

  document.addEventListener("click", (event) => {
    const target = getPrintTarget(event.target);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    printBinder(target.mode);
  }, true);
})();
