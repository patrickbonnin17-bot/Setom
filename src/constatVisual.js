import "./constatVisual.css";

function markConstatModal(root = document) {
  const nodes = root.querySelectorAll?.(".modal, .modal-overlay, .modal-bg") || [];
  nodes.forEach((node) => {
    const text = String(node.textContent || "").toLowerCase();
    const isConstat = text.includes("constat") || text.includes("travaux réalisés") && text.includes("validation");
    if (isConstat) node.classList.add("setom-constat-modal");
  });
}

if (typeof window !== "undefined") {
  const run = () => markConstatModal(document);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
  const observer = new MutationObserver(() => markConstatModal(document));
  observer.observe(document.body, { childList: true, subtree: true });
}
