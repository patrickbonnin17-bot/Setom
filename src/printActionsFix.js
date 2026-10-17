// Reliable, targeted printing for the daily and weekly binders.
(function installPrintActions() {
  const PRINT_LABEL = /\bimprimer\b/i;

  function getPrintTarget(target) {
    const element = target?.closest?.('button, a, [role="button"], input[type="button"], input[type="submit"]');
    if (!element) return null;
    const label = String(element.textContent || element.value || element.getAttribute("aria-label") || "").trim();
    if (!PRINT_LABEL.test(label)) return null;
    if (element.closest(".setom-binder")) return { mode: "daily", binder: element.closest(".setom-binder") };
    if (element.closest(".setom-week-binder")) return { mode: "week", binder: element.closest(".setom-week-binder") };
    return null;
  }

  function openPrintWindow(mode, binder) {
    // Open synchronously from the user's click. This avoids iOS/Safari losing
    // the user gesture before the print document is created.
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      // Popup blocked: fall back to the native print API while still inside
      // the original click event.
      window.print();
      return;
    }

    const title = mode === "week" ? "SETOM — Classeur hebdomadaire" : "SETOM — Classeur journalier";
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join("\n");
    const content = binder.cloneNode(true);

    // Remove interactive controls from the printed copy.
    content.querySelectorAll("button, input, select, textarea").forEach((node) => node.remove());

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${styles}<style>
      @page { margin: 12mm; size: A4 portrait; }
      html, body { margin: 0; padding: 0; background: #fff !important; color: #172033; }
      body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .setom-binder, .setom-week-binder { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
      .setom-binder-card, .setom-week-binder-day { break-inside: avoid; page-break-inside: avoid; }
      .setom-binder-head { margin-bottom: 10px !important; }
      @media print { .setom-binder-head button { display:none !important; } }
    </style></head><body></body></html>`);
    printWindow.document.body.appendChild(content);
    printWindow.document.close();

    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      printWindow.focus();
      printWindow.print();
    };

    printWindow.addEventListener("afterprint", () => {
      window.setTimeout(() => printWindow.close(), 300);
    });
    printWindow.addEventListener("load", doPrint, { once: true });
    // WebKit can finish a document.write without firing load reliably.
    window.setTimeout(doPrint, 250);
  }

  document.addEventListener("click", (event) => {
    const target = getPrintTarget(event.target);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPrintWindow(target.mode, target.binder);
  }, true);
})();
