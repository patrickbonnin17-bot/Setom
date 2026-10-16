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
    if (status && EDITABLE_STATUSES.has(status)) fieldset.disabled = false;
  }
}

let timer;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(unlockWorkForm, 80);
}

new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
window.addEventListener("setom:planning-updated", schedule);
setTimeout(unlockWorkForm, 500);
