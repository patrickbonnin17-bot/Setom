const BUTTON_IDS = [
  "setom-daily-labor-cost-btn",
  "setom-materials-finance-widget-btn",
  "setom-materials-stock-widget-button",
  "setom-profitability-widget-btn",
];

const DOCK_ID = "setom-management-tools-dock";
const DASHBOARD_DOCK_ID = "setom-dashboard-management-tools";

function getButtons() {
  return BUTTON_IDS.map((id) => document.getElementById(id)).filter(Boolean);
}

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

function ensureDashboardDock() {
  const cards = document.querySelector(".cards");
  if (!cards) return null;
  let dock = document.getElementById(DASHBOARD_DOCK_ID);
  if (!dock) {
    dock = document.createElement("section");
    dock.id = DASHBOARD_DOCK_ID;
    dock.setAttribute("aria-label", "Pilotage chantier");
    dock.innerHTML = `
      <div class="setom-dashboard-pilotage-heading">
        <div>
          <div class="setom-dashboard-pilotage-title">Pilotage chantier</div>
          <div class="setom-dashboard-pilotage-subtitle">Temps, coûts, matériaux et rentabilité</div>
        </div>
        <span class="setom-dashboard-pilotage-tag">Gestion</span>
      </div>
      <div class="setom-dashboard-pilotage-actions"></div>
    `;
    cards.insertAdjacentElement("afterend", dock);
  }
  return dock.querySelector(".setom-dashboard-pilotage-actions");
}

function moveButtonsToDock() {
  const dock = ensureDock();
  if (!dock) return;
  getButtons().forEach((button) => {
    if (button.parentElement !== dock) dock.appendChild(button);
  });
}

function moveButtonsToDashboard() {
  const dock = ensureDashboardDock();
  if (!dock) return;
  getButtons().forEach((button) => {
    if (button.parentElement !== dock) dock.appendChild(button);
  });
}

function restoreButtons() {
  const dock = document.getElementById(DOCK_ID);
  const dashboardDock = document.getElementById(DASHBOARD_DOCK_ID);
  getButtons().forEach((button) => {
    if (button.parentElement === dock || button.parentElement === dashboardDock?.querySelector(".setom-dashboard-pilotage-actions")) {
      document.body.appendChild(button);
    }
  });
  dock?.remove();
  dashboardDock?.remove();
}

function installStyles() {
  if (document.getElementById("setom-management-tools-dock-style")) return;
  const style = document.createElement("style");
  style.id = "setom-management-tools-dock-style";
  style.textContent = `
    #${DOCK_ID}{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-left:auto;padding:5px 7px;border:1px solid #dbe3ee;border-radius:12px;background:#f8fafc}
    #${DOCK_ID} .setom-management-tools-label{font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em;padding:0 4px}
    #${DOCK_ID} > button{position:static!important;right:auto!important;bottom:auto!important;left:auto!important;top:auto!important;z-index:auto!important;margin:0!important;box-shadow:none!important;padding:8px 11px!important;border-radius:8px!important;font-size:12px!important;white-space:nowrap}
    #${DOCK_ID} > button:hover,#${DASHBOARD_DOCK_ID} button:hover{filter:brightness(.96);transform:translateY(-1px)}
    #${DASHBOARD_DOCK_ID}{margin:18px 0 22px;padding:16px 18px;border:1px solid #dbe3ee;border-radius:16px;background:linear-gradient(135deg,#ffffff,#f8fafc);box-shadow:0 4px 14px rgba(15,23,42,.05)}
    .setom-dashboard-pilotage-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
    .setom-dashboard-pilotage-title{font-size:16px;font-weight:850;color:#17202a}
    .setom-dashboard-pilotage-subtitle{margin-top:2px;font-size:12px;color:#667085}
    .setom-dashboard-pilotage-tag{font-size:11px;font-weight:800;color:#475467;background:#eef2f6;border:1px solid #dbe3ee;border-radius:999px;padding:5px 9px}
    .setom-dashboard-pilotage-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    #${DASHBOARD_DOCK_ID} .setom-dashboard-pilotage-actions > button{position:static!important;inset:auto!important;z-index:auto!important;width:100%!important;margin:0!important;box-shadow:none!important;border-radius:10px!important;padding:11px 12px!important;font-size:13px!important;white-space:nowrap}
    @media(max-width:1100px){.setom-dashboard-pilotage-actions{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:600px){#${DASHBOARD_DOCK_ID}{padding:14px;margin:14px 0 18px}.setom-dashboard-pilotage-heading{align-items:flex-start}.setom-dashboard-pilotage-tag{display:none}.setom-dashboard-pilotage-actions{grid-template-columns:1fr}.setom-dashboard-pilotage-actions > button{white-space:normal!important}}
    @media(max-width:900px){#${DOCK_ID}{width:100%;margin-left:0;order:3}#${DOCK_ID} .setom-management-tools-label{display:none}}
  `;
  document.head.appendChild(style);
}

installStyles();
let currentLocation = "none";
let observer;

function tick() {
  const plannerOpen = !!document.querySelector(".setom-planner");
  const dashboardOpen = !plannerOpen && !!document.querySelector(".cards");
  const nextLocation = plannerOpen ? "planner" : dashboardOpen ? "dashboard" : "none";

  if (nextLocation === "planner") {
    moveButtonsToDock();
  } else if (nextLocation === "dashboard") {
    document.getElementById(DOCK_ID)?.remove();
    moveButtonsToDashboard();
  } else {
    restoreButtons();
  }
  currentLocation = nextLocation;
}

observer = new MutationObserver(tick);
observer.observe(document.body, { childList: true, subtree: true });
setInterval(tick, 500);
tick();
