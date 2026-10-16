// Bridge the field-intervention workflow into the real OS detail modal.
// The workflow itself intentionally targets explicit OS containers. The React
// OS detail modal has a stable .os-detail-modal class, so create one small
// explicit OS container there and let the workflow add its normal action button.
(function bootFieldInterventionButtonBridge() {
  const BRIDGE_ATTR = "data-setom-field-bridge";

  function getOsNumber(text) {
    const value = String(text || "");
    const patterns = [
      /OS[-\s]?\d{4}[-\s]?(\d{3,8})/i,
      /(?:OS|ordre)\s*[#:]?\s*(\d{3,8})/i
    ];
    for (const pattern of patterns) {
      const match = value.match(pattern);
      if (match) return String(match[1]).replace(/\D/g, "");
    }
    return "";
  }

  function ensureBridge() {
    const modal = document.querySelector(".os-detail-modal");
    if (!modal || modal.querySelector(`[${BRIDGE_ATTR}="1"]`)) return;

    const osNumber = getOsNumber(modal.textContent);
    if (!osNumber) return;

    const host = document.createElement("div");
    host.className = "setom-os-card";
    host.setAttribute("data-os-number", osNumber);
    host.setAttribute(BRIDGE_ATTR, "1");
    host.style.cssText = "margin:16px 0 4px;padding:0;";

    const heading = document.createElement("div");
    heading.textContent = "Intervention terrain";
    heading.style.cssText = "margin-bottom:7px;font:700 12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#667085;";
    host.appendChild(heading);

    const anchor = modal.querySelector(".modal-actions,.actions,.os-actions,.modal-footer") || modal.querySelector("form") || modal;
    if (anchor === modal) modal.appendChild(host);
    else anchor.parentNode?.insertBefore(host, anchor);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureBridge();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
  } else {
    schedule();
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length) {
        schedule();
        break;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
