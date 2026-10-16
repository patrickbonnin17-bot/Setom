const BUTTON_IDS = [
  "setom-daily-labor-cost-btn",
  "setom-materials-finance-widget-btn",
  "setom-materials-stock-widget-button",
  "setom-profitability-widget-btn",
];

const DOCK_ID = "setom-management-tools-dock";

function ensureDock() {
  const toolbar = document.querySelector(".setom-plan-toolbar");
  if (!toolbar) return null;
  let dock = document.getElementById(DOCK_ID);
  if (!dock) {
    dock = document.createElement("div");
    dock.id = DOCK_ID;
    dock.setAttribute("aria-label", "Pilotage chantier");
    const label = document.createElement("span");
    label.className = "setom-management-tools-label";
    label.textContent = "Pilotage";
    dock.appendChild(label);
    toolbar.appendChild(dock);
  }
  return dock;
}

function moveButtonsToDock() {
  const dock = ensureDock();
  if (!dock) return;
  BUTTON_IDS.forEach((id) => {
    const button = document.getElementById(id);
    if (button && button.parentElement !== dock) dock.appendChild(button);
  });
}

function restoreButtons() {
  const dock = document.getElementById(DOCK_ID);
  if (!dock) return;
  BUTTON_IDS.forEach((id) => {
    const button = document.getElementById(id);
    if (button && button.parentElement === dock) document.body.appendChild(button);
  });
  dock.remove();
}

function installStyles() {
  if (document.getElementById("setom-management-tools-dock-style")) return;
  const style = document.createElement("style");
  style.id = "setom-management-tools-dock-style";
  style.textContent = `
    #${DOCK_ID}{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-left:auto;padding:5px 7px;border:1px solid #dbe3ee;border-radius:12px;background:#f8fafc}
    #${DOCK_ID} .setom-management-tools-label{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em;padding:0 4px}
    #${DOCK_ID} > button{position:static!important;right:auto!important;bottom:auto!important;left:auto!important;top:auto!important;z-index:auto!important;margin:0!important;box-shadow:none!important;padding:8px 11px!important;border-radius:8px!important;font-size:12px!important;white-space:nowrap}
    #${DOCK_ID} > button:hover{filter:brightness(.96);transform:translateY(-1px)}
    @media(max-width:900px){#${DOCK_ID}{width:100%;margin-left:0;order:3}#${DOCK_ID} .setom-management-tools-label{display:none}}
  `;
  document.head.appendChild(style);
}

installStyles();
let plannerWasOpen = false;
let observer;
function tick() {
  const plannerOpen = !!document.querySelector(".setom-planner");
  if (plannerOpen) {
    moveButtonsToDock();
    plannerWasOpen = true;
  } else if (plannerWasOpen) {
    restoreButtons();
    plannerWasOpen = false;
  }
}

observer = new MutationObserver(tick);
observer.observe(document.body, { childList: true, subtree: true });
setInterval(tick, 500);
tick();
