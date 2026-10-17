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
    // Open synchronously from the user's click so iOS/Safari sees this as a
    // user-initiated tab rather than a delayed popup.
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      // If the browser blocks the new tab, stay in the original user gesture.
      window.print();
      return;
    }

    const title = mode === "week" ? "SETOM — Classeur hebdomadaire" : "SETOM — Classeur journalier";
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join("\n");
    const content = binder.cloneNode(true);

    // Remove controls from the printed document; the print page itself has
    // its own explicit fallback button below.
    content.querySelectorAll("button, input, select, textarea").forEach((node) => node.remove());

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${styles}<style>
      @page { margin: 12mm; size: A4 portrait; }
      html, body { margin: 0; padding: 0; background: #fff !important; color: #172033; }
      body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .setom-binder, .setom-week-binder { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
      .setom-binder-card, .setom-week-binder-day { break-inside: avoid; page-break-inside: avoid; }
      .setom-print-fallback { position: sticky; top: 0; z-index: 10; display: flex; gap: 10px; align-items: center; padding: 12px; margin: 0 0 14px; background: #172033; color: #fff; font: 600 15px/1.35 system-ui, sans-serif; border-radius: 10px; }
      .setom-print-fallback button { border: 0; border-radius: 8px; padding: 10px 14px; background: #fff; color: #172033; font: inherit; cursor: pointer; }
      .setom-print-fallback span { opacity: .9; font-weight: 500; }
      @media print { .setom-print-fallback { display: none !important; } }
    </style></head><body>
      <div class="setom-print-fallback"><button id="setom-launch-print">🖨️ Lancer l’impression</button><span>Si la fenêtre d’impression ne s’est pas ouverte automatiquement, appuie ici.</span></div>
    </body></html>`);
    printWindow.document.body.appendChild(content);
    printWindow.document.close();

    let printed = false;
    const doPrint = () => {
      if (printed || printWindow.closed) return;
      printed = true;
      printWindow.focus();
      try { printWindow.print(); } catch (_) { printed = false; }
    };

    const fallbackButton = printWindow.document.getElementById("setom-launch-print");
    fallbackButton?.addEventListener("click", () => {
      printed = true;
      printWindow.focus();
      printWindow.print();
    });

    printWindow.addEventListener("afterprint", () => {
      window.setTimeout(() => printWindow.close(), 300);
    });

    // Try automatically once the print document is ready. The visible button
    // remains available as a direct user-gesture fallback on iPhone/iPad.
    printWindow.addEventListener("load", doPrint, { once: true });
    window.setTimeout(doPrint, 400);
  }

  document.addEventListener("click", (event) => {
    const target = getPrintTarget(event.target);
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPrintWindow(target.mode, target.binder);
  }, true);
})();
