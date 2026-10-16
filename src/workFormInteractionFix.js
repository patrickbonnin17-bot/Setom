const WORKABLE_STATUS_SET = ["Planifié", "Travaux en cours", "Travaux réalisés"];
const originalIncludes = Array.prototype.includes;

// The main OS component contains the work workflow guards. Keep the existing
// component unchanged while allowing the explicit "En travaux" state to use
// the same work-entry/transmission path as the other active work states.
Array.prototype.includes = function patchedIncludes(searchElement, fromIndex) {
  if (
    searchElement === "En travaux" &&
    this.length === WORKABLE_STATUS_SET.length &&
    WORKABLE_STATUS_SET.every((status, index) => this[index] === status)
  ) {
    return true;
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

new MutationObserver(schedule).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["disabled"]
});
window.addEventListener("setom:planning-updated", schedule);
setTimeout(unlockWorkForm, 200);
