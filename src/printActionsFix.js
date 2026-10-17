// Reliable print action for the binder and weekly binder.
// Some legacy binder buttons render correctly but do not have a live handler.
(function installPrintActions() {
  const PRINT_LABEL = /\bimprimer\b/i;

  function isPrintTarget(target) {
    const element = target?.closest?.('button, a, [role="button"], input[type="button"], input[type="submit"]');
    if (!element) return false;
    const label = String(element.textContent || element.value || element.getAttribute('aria-label') || '').trim();
    if (!PRINT_LABEL.test(label)) return false;
    return Boolean(element.closest('.setom-binder-card, .setom-week-binder-row, .setom-week-binder, .setom-binder'));
  }

  document.addEventListener('click', (event) => {
    if (!isPrintTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    window.setTimeout(() => window.print(), 0);
  }, true);
})();
