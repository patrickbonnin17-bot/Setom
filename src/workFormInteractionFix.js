const STATUS_GUARD_SETS = [
  ["Planifié", "Travaux en cours", "Travaux réalisés"],
  ["Nouveau", "À planifier", "Planifié", "Travaux en cours", "En erreur"],
  ["À planifier", "Planifié", "Travaux en cours", "En erreur"],
];
const originalIncludes = Array.prototype.includes;

// The main OS component contains several workflow guards. Keep the existing
// component unchanged while allowing the explicit "En travaux" state to use
// the same edit, issue-reporting and work-transmission paths as the other
// active states. This runtime fallback also protects non-Vite deployments.
Array.prototype.includes = function patchedIncludes(searchElement, fromIndex) {
  if (searchElement === "En travaux") {
    for (const statuses of STATUS_GUARD_SETS) {
      if (this.length === statuses.length && statuses.every((status, index) => this[index] === status)) {
        return true;
      }
    }
  }
  return originalIncludes.call(this, searchElement, fromIndex);
};

const WORK_TAB_TITLE = "Travaux réalisés";
const EDITABLE_STATUSES = new Set(["Planifié", "En travaux", "Travaux en cours", "Travaux réalisés"]);

function unlockWorkForm() {
  const sections = [...document.querySelectorAll(".os-section")];
  for (const section of sections) {
    const title = section.querySelector("h3")?.textContent?.trim();
    if (title !== WORK_TAB_TITLE) continue;
    const modal = section.closest(".os-detail-modal, .modal");
    const statusNodes = [...(modal?.querySelectorAll(".os-detail-summary .os-detail-badge strong") || [])];
    const status = statusNodes.map((node) => node.textContent?.trim()).find((value) => EDITABLE_STATUSES.has(value));
    const fieldset = section.querySelector("fieldset");
    if (!fieldset) continue;
    if (status && EDITABLE_STATUSES.has(status)) {
      fieldset.disabled = false;
      section.querySelectorAll("input, select, textarea, button").forEach((control) => {
        if (!control.dataset.setomWorkSavingLock) control.disabled = false;
      });
    }
  }
}

let timer;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(unlockWorkForm, 40);
}

function initWorkFormInteractionFix() {
  if (!document.body) return;
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled"]
  });
  window.addEventListener("setom:planning-updated", schedule);
  setTimeout(unlockWorkForm, 200);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWorkFormInteractionFix, { once: true });
} else {
  initWorkFormInteractionFix();
}
