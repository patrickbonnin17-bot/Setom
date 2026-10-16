const BUTTON_IDS = [
  "setom-daily-labor-cost-btn",
  "setom-materials-finance-widget-btn",
  "setom-materials-stock-widget-button",
  "setom-profitability-widget-btn",
];

const PARKING_ID = "setom-management-tools-parking";
const PILOTAGE_PAGE_ID = "setom-pilotage-page";
const PILOTAGE_ACTIONS_ID = "setom-pilotage-actions";

function getButtons() {
  return BUTTON_IDS.map((id) => document.getElementById(id)).filter(Boolean);
}

function ensureParking() {
  let parking = document.getElementById(PARKING_ID);
  if (!parking) {
    parking = document.createElement("div");
    parking.id = PARKING_ID;
    parking.setAttribute("aria-hidden", "true");
    document.body.appendChild(parking);
  }
  return parking;
}

function moveButtons() {
  const pilotagePage = document.getElementById(PILOTAGE_PAGE_ID);
  const actions = document.getElementById(PILOTAGE_ACTIONS_ID);
  const target = pilotagePage?.style.display === "block" && actions ? actions : ensureParking();
  getButtons().forEach((button) => {
    if (button.parentElement !== target) target.appendChild(button);
  });
}

function cleanupLegacyDocks() {
  document.getElementById("setom-management-tools-dock")?.remove();
  document.getElementById("setom-dashboard-management-tools")?.remove();
}

function installStyles() {
  if (document.getElementById("setom-management-tools-dock-style")) return;
  const style = document.createElement("style");
  style.id = "setom-management-tools-dock-style";
  style.textContent = `
    #${PARKING_ID}{display:none!important;width:0!important;height:0!important;overflow:hidden!important;position:absolute!important;pointer-events:none!important}
    #${PILOTAGE_ACTIONS_ID}>button{position:static!important;inset:auto!important;z-index:auto!important;width:100%!important;min-height:76px!important;margin:0!important;box-shadow:0 3px 10px rgba(15,23,42,.06)!important;border-radius:12px!important;padding:14px 12px!important;white-space:normal!important;font-size:13px!important}
    #${PILOTAGE_ACTIONS_ID}>button:hover{transform:translateY(-2px);filter:brightness(.98)}
  `;
  document.head.appendChild(style);
}

installStyles();
const observer = new MutationObserver(() => {
  cleanupLegacyDocks();
  moveButtons();
});
observer.observe(document.body, { childList: true, subtree: true });
setInterval(moveButtons, 500);
cleanupLegacyDocks();
moveButtons();
