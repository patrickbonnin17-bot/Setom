// Keep the OS detail modal above the planning/classeur overlay.
// The React modal is rendered inside #root, so z-index alone can lose to
// another stacking context. Moving the modal layer itself to <body> makes
// it a true top-level overlay while React continues to own the same nodes.
(function installOSModalPortalFix() {
  let currentLayer = null;
  let originalParent = null;
  let originalNextSibling = null;
  let observer = null;

  function liftModalLayer() {
    const layer = document.querySelector(".modal-bg:has(.os-detail-modal)");
    if (!layer || layer === currentLayer) return;

    currentLayer = layer;
    originalParent = layer.parentNode;
    originalNextSibling = layer.nextSibling;

    document.body.appendChild(layer);
    layer.style.position = "fixed";
    layer.style.inset = "0";
    layer.style.zIndex = "2147483646";
    layer.style.isolation = "isolate";

    const modal = layer.querySelector(".os-detail-modal");
    if (modal) {
      modal.style.position = "relative";
      modal.style.zIndex = "2147483647";
    }
  }

  function resetIfClosed() {
    if (!currentLayer || document.body.contains(currentLayer)) {
      const modal = currentLayer?.querySelector?.(".os-detail-modal");
      if (modal) {
        modal.style.position = "relative";
        modal.style.zIndex = "2147483647";
      }
      return;
    }
    currentLayer = null;
    originalParent = null;
    originalNextSibling = null;
  }

  observer = new MutationObserver(() => {
    liftModalLayer();
    resetIfClosed();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  liftModalLayer();
})();
