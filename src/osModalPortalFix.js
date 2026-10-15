// Keep the OS detail modal above the planning/classeur overlay without moving
// React-owned DOM nodes out of #root. Moving a React subtree to <body> breaks
// React's delegated events, which makes the close button and tabs unreliable.
(function installOSModalLayerFix() {
  let root = null;
  let rootOriginalPosition = "";
  let rootOriginalZIndex = "";
  let raised = false;
  let observer = null;

  function raiseApplicationLayer() {
    root = document.getElementById("root");
    const modal = document.querySelector(".os-detail-modal");

    if (!root || !modal) {
      if (raised) restoreApplicationLayer();
      return;
    }

    if (!raised) {
      rootOriginalPosition = root.style.position || "";
      rootOriginalZIndex = root.style.zIndex || "";
      raised = true;
    }

    // The planner/classeur lives in a separate stacking context. Raising the
    // whole React root keeps the modal interactive while its backdrop hides the
    // underlying application and the binder remains mounted underneath.
    root.style.position = "relative";
    root.style.zIndex = "2147483646";

    const layer = modal.closest(".modal-bg");
    if (layer) {
      layer.style.position = "fixed";
      layer.style.inset = "0";
      layer.style.zIndex = "2147483647";
      layer.style.pointerEvents = "auto";
    }

    modal.style.position = "relative";
    modal.style.zIndex = "2147483647";
    modal.style.pointerEvents = "auto";

    const closeButton = modal.querySelector(".close");
    if (closeButton) {
      closeButton.style.position = "relative";
      closeButton.style.zIndex = "2147483648";
      closeButton.style.pointerEvents = "auto";
    }
  }

  function restoreApplicationLayer() {
    if (!root) return;
    root.style.position = rootOriginalPosition;
    root.style.zIndex = rootOriginalZIndex;
    root = null;
    rootOriginalPosition = "";
    rootOriginalZIndex = "";
    raised = false;
  }

  observer = new MutationObserver(() => {
    raiseApplicationLayer();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  raiseApplicationLayer();
})();
